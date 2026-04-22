// ════════════════════════════════════════════════════════════════════════
// github-apply-patch — apply a unified diff to the cifra repo as a
// single commit on main, via the GitHub REST API.
//
// Context: cifra runs on Vercel. Serverless functions don't have a
// filesystem we can `git apply` into. The GitHub "Git Data" API is
// the only way to write to the repo from a server-side endpoint.
//
// Flow:
//   1. GET main ref → latest commit SHA
//   2. GET commit → base tree SHA
//   3. For each target file in the diff:
//      a. GET contents/<path>?ref=main → current content (base64)
//      b. Apply the unified diff to the content in memory via jsdiff
//         applyPatch(). Returns false on conflict → we abort.
//      c. POST blobs with the new content → new blob SHA
//   4. POST trees with base_tree=<current tree SHA> and
//      tree:[{path,mode,type:'blob',sha:<newBlobSha>},...] → new tree
//   5. POST commits with parents=[currentSha], tree=<newTreeSha>,
//      message → new commit SHA
//   6. PATCH ref with sha=<newCommitSha> → main moves forward
//
// Idempotency is the caller's responsibility — the accept-patch
// endpoint stamps patch_applied_at in the same transaction so a second
// click is a no-op.
//
// Credentials:
//   - Requires GITHUB_TOKEN env var with `repo` scope (classic PAT) OR
//     fine-grained PAT with Contents: write + Metadata: read on
//     diego10av/cifra.
//   - If GITHUB_TOKEN is missing, applyPatchToRepo() throws with a
//     readable error — the caller returns 501 to the UI so the
//     reviewer can still fall back to the copy-command path.
//
// Conflict handling:
//   - If main has moved since the drafter ran, the patch may no
//     longer apply cleanly. applyPatch() returns false → we throw
//     { code: 'conflict' } so the UI can show "Main has moved; reject
//     this draft and run Scan again to regenerate".
// ════════════════════════════════════════════════════════════════════════

import { applyPatch } from 'diff';
import { logger } from '@/lib/logger';

const log = logger.bind('github-apply-patch');

export interface ApplyOpts {
  /** "owner/repo", e.g. "diego10av/cifra". Default from env. */
  repo?: string;
  /** Branch to update. Default "main". */
  branch?: string;
  /** The unified diff. Must start with proper --- / +++ headers. */
  diff: string;
  /** Commit message for the new commit. */
  commitMessage: string;
}

export interface ApplyResult {
  commit_sha: string;
  commit_url: string;
  files_changed: string[];
}

/** Whitelist of files an AI-drafted patch may touch. Exported so the
 *  update-patch endpoint can re-enforce the same whitelist when a human
 *  edits the diff before acceptance — we don't want a reviewer casually
 *  rewriting the diff to touch package.json and slipping past apply. */
export const ALLOWED_FILES = new Set([
  'src/config/classification-rules.ts',
  'src/config/legal-sources.ts',
  'src/config/exemption-keywords.ts',
  'src/__tests__/fixtures/synthetic-corpus.ts',
]);

export async function applyPatchToRepo(opts: ApplyOpts): Promise<ApplyResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw Object.assign(new Error('GITHUB_TOKEN not configured'), {
      code: 'no_token',
      status: 501,
    });
  }
  const repo = opts.repo ?? process.env.GITHUB_REPO ?? 'diego10av/cifra';
  const branch = opts.branch ?? 'main';

  const paths = extractFilePaths(opts.diff);
  if (paths.length === 0) {
    throw Object.assign(new Error('No file paths found in diff'), {
      code: 'invalid_diff',
      status: 400,
    });
  }

  // Safety-net blast radius check (the drafter already enforced
  // this but we re-verify at apply time — a stored diff must not
  // become a prod commit if it slipped past the first check).
  const offWhitelist = paths.filter(p => !ALLOWED_FILES.has(p));
  if (offWhitelist.length > 0) {
    throw Object.assign(new Error(
      `Diff touches non-whitelisted files: ${offWhitelist.join(', ')}`,
    ), { code: 'blast_radius', status: 400 });
  }

  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cifra-rule-patch-drafter/1.0',
  };

  // 1. Current ref
  const refRes = await fetch(`${api}/git/refs/heads/${branch}`, { headers });
  if (!refRes.ok) {
    throw githubError('get_ref', refRes.status, await refRes.text());
  }
  const refJson = (await refRes.json()) as { object: { sha: string } };
  const currentSha = refJson.object.sha;

  // 2. Current tree SHA from the commit
  const commitRes = await fetch(`${api}/git/commits/${currentSha}`, { headers });
  if (!commitRes.ok) {
    throw githubError('get_commit', commitRes.status, await commitRes.text());
  }
  const commitJson = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = commitJson.tree.sha;

  // 3. Extract per-file diffs + apply them to current content in memory.
  const perFileDiffs = splitUnifiedDiffByFile(opts.diff);
  const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];

  for (const { path, fileDiff } of perFileDiffs) {
    // a. GET current content
    const contentRes = await fetch(
      `${api}/contents/${encodeURIComponent(path)}?ref=${branch}`,
      { headers },
    );
    if (!contentRes.ok) {
      throw githubError('get_contents', contentRes.status, await contentRes.text(), path);
    }
    const contentJson = (await contentRes.json()) as { content: string; encoding: string };
    if (contentJson.encoding !== 'base64') {
      throw Object.assign(new Error(`Unexpected encoding ${contentJson.encoding} for ${path}`), {
        code: 'bad_encoding', status: 500,
      });
    }
    const oldContent = Buffer.from(contentJson.content, 'base64').toString('utf8');

    // b. Apply the unified diff to the file's content in memory.
    //    jsdiff applyPatch returns false if the patch doesn't match.
    const newContent = applyPatch(oldContent, fileDiff);
    if (newContent === false) {
      throw Object.assign(new Error(
        `Patch does not apply cleanly to ${path}. Main may have moved since the drafter ran — reject this proposal and scan again.`,
      ), { code: 'conflict', status: 409, path });
    }

    // c. POST blob
    const blobRes = await fetch(`${api}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent, encoding: 'utf-8' }),
    });
    if (!blobRes.ok) {
      throw githubError('post_blob', blobRes.status, await blobRes.text(), path);
    }
    const blobJson = (await blobRes.json()) as { sha: string };

    treeEntries.push({ path, mode: '100644', type: 'blob', sha: blobJson.sha });
  }

  // 4. POST tree
  const treeRes = await fetch(`${api}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });
  if (!treeRes.ok) {
    throw githubError('post_tree', treeRes.status, await treeRes.text());
  }
  const treeJson = (await treeRes.json()) as { sha: string };

  // 5. POST commit
  const commitPostRes = await fetch(`${api}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: opts.commitMessage,
      tree: treeJson.sha,
      parents: [currentSha],
    }),
  });
  if (!commitPostRes.ok) {
    throw githubError('post_commit', commitPostRes.status, await commitPostRes.text());
  }
  const commitPostJson = (await commitPostRes.json()) as {
    sha: string;
    html_url: string;
  };

  // 6. PATCH ref to move main forward
  const updateRefRes = await fetch(`${api}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commitPostJson.sha, force: false }),
  });
  if (!updateRefRes.ok) {
    // 422 "Update is not a fast-forward" means main moved during the
    // window → someone else pushed. Translate to our conflict code.
    if (updateRefRes.status === 422) {
      throw Object.assign(new Error(
        `Main moved during commit. Reject the draft and scan again so the drafter regenerates against fresh HEAD.`,
      ), { code: 'race_conflict', status: 409 });
    }
    throw githubError('update_ref', updateRefRes.status, await updateRefRes.text());
  }

  log.info('patch applied', {
    commit_sha: commitPostJson.sha.slice(0, 7),
    files: paths,
  });

  return {
    commit_sha: commitPostJson.sha,
    commit_url: commitPostJson.html_url,
    files_changed: paths,
  };
}

// ─────────────────────────────────────────────────────────────────
export function extractFilePaths(diff: string): string[] {
  const paths = new Set<string>();
  for (const m of diff.matchAll(/^\+\+\+\s+b\/(.+?)$/gm)) {
    const p = m[1].trim();
    if (p && p !== '/dev/null') paths.add(p);
  }
  for (const m of diff.matchAll(/^diff --git a\/(.+?)\s+b\/.+?$/gm)) {
    paths.add(m[1].trim());
  }
  return Array.from(paths);
}

/** Split a unified diff containing multiple files into one chunk per
 *  file. jsdiff's applyPatch operates on single-file diffs. */
function splitUnifiedDiffByFile(diff: string): Array<{ path: string; fileDiff: string }> {
  const result: Array<{ path: string; fileDiff: string }> = [];
  // Split on `diff --git` OR on `--- a/<path>` if `diff --git` missing.
  const lines = diff.split('\n');
  let current: { path: string; lines: string[] } | null = null;
  for (const line of lines) {
    const startGit = line.match(/^diff --git a\/(.+?)\s+b\/(.+?)$/);
    const startMinus = line.match(/^---\s+a\/(.+?)$/);
    if (startGit || (startMinus && !current)) {
      if (current) result.push({ path: current.path, fileDiff: current.lines.join('\n') });
      const path = (startGit ? startGit[2] : startMinus![1]).trim();
      current = { path, lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) result.push({ path: current.path, fileDiff: current.lines.join('\n') });
  return result;
}

interface GitHubError extends Error {
  code: string;
  status: number;
  path?: string;
  gh_status?: number;
  gh_body?: string;
}

function githubError(op: string, status: number, body: string, path?: string): GitHubError {
  const msg = `GitHub ${op} failed: ${status}${path ? ` (${path})` : ''} — ${body.slice(0, 200)}`;
  const e = new Error(msg) as GitHubError;
  e.code = `gh_${op}`;
  e.status = 502;
  e.gh_status = status;
  e.gh_body = body.slice(0, 500);
  if (path) e.path = path;
  return e;
}
