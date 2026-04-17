// ════════════════════════════════════════════════════════════════════════
// Markdown-lite parser for chat messages.
//
// Not a full markdown implementation — Claude's chat output is usually
// short paragraphs and a few bullets. Pulling in a big markdown lib is
// overkill. We handle what actually appears:
//   - paragraph breaks (blank line)
//   - bulleted lists (- / * / •)
//   - numbered lists (1. 2. …)
//   - inline: **bold** / __bold__, `code`, [LEGAL_REF] pills
//
// This module returns a neutral AST (arrays of block/inline nodes) that
// the React renderer consumes. Keeping it pure + data-first means we
// can unit-test behaviour without a DOM.
//
// Security: output is tree of plain strings + typed nodes. The React
// renderer then wraps them in components; React auto-escapes text
// children. No HTML injection path.
// ════════════════════════════════════════════════════════════════════════

export type InlineNode =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'legal'; text: string };

export type BlockNode =
  | { kind: 'paragraph'; children: InlineNode[] }
  | { kind: 'ul'; items: InlineNode[][] }
  | { kind: 'ol'; items: InlineNode[][] };

const LEGAL = /(\[[A-Z_][A-Z0-9_. §§§()/-]*(?:\sArt\.?\s\d+[a-z]*)?(?:§\d+)?(?:\s\w+)?])/g;
const BOLD = /(\*\*[^*\n]+\*\*|__[^_\n]+__)/g;
const CODE = /(`[^`\n]+`)/g;

export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];

  const legalPieces = text.split(LEGAL);
  for (const piece of legalPieces) {
    if (piece.startsWith('[') && piece.endsWith(']')) {
      out.push({ kind: 'legal', text: piece.slice(1, -1) });
      continue;
    }
    // Bold pass
    const boldPieces = piece.split(BOLD);
    for (const bp of boldPieces) {
      if (bp === '') continue;
      if ((bp.startsWith('**') && bp.endsWith('**') && bp.length >= 4) ||
          (bp.startsWith('__') && bp.endsWith('__') && bp.length >= 4)) {
        out.push({ kind: 'bold', text: bp.slice(2, -2) });
        continue;
      }
      // Inline-code pass
      const codePieces = bp.split(CODE);
      for (const cp of codePieces) {
        if (cp === '') continue;
        if (cp.startsWith('`') && cp.endsWith('`') && cp.length >= 2) {
          out.push({ kind: 'code', text: cp.slice(1, -1) });
        } else {
          out.push({ kind: 'text', text: cp });
        }
      }
    }
  }

  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+\.\s+/;

export function parseBlocks(text: string): BlockNode[] {
  const lines = text.split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Skip blank lines between blocks
    if (line.trim() === '') {
      i++;
      continue;
    }

    if (BULLET.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && BULLET.test(lines[i]!)) {
        items.push(parseInline(lines[i]!.replace(BULLET, '')));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (NUMBERED.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && NUMBERED.test(lines[i]!)) {
        items.push(parseInline(lines[i]!.replace(NUMBERED, '')));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Collect consecutive plain lines into a single paragraph.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !BULLET.test(lines[i]!) &&
      !NUMBERED.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push({ kind: 'paragraph', children: parseInline(para.join('\n')) });
  }

  return blocks;
}
