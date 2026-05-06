// ════════════════════════════════════════════════════════════════════════
// scripts/gen-favicon.ts — Regenerate src/app/favicon.ico from public/favicon.svg.
//
// The SVG is the canonical mark (`public/favicon.svg`), but we still ship an
// ICO at the App Router convention path (`src/app/favicon.ico`) for browsers
// that prefer it (Safari, older Chrome cache). The ICO embeds 16/32/48-px
// PNGs — modern ICO format that all current browsers handle.
//
// Usage: `npx tsx scripts/gen-favicon.ts`
//
// Run when the SVG changes. The .ico is committed to git.
// ════════════════════════════════════════════════════════════════════════

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SVG_PATH = join(process.cwd(), 'public', 'favicon.svg');
const ICO_PATH = join(process.cwd(), 'src', 'app', 'favicon.ico');
const SIZES = [16, 32, 48];

async function main() {
  const svg = readFileSync(SVG_PATH);
  const pngs = await Promise.all(
    SIZES.map(s => sharp(svg).resize(s, s).png().toBuffer())
  );

  // ICO container: 6-byte header + N×16-byte directory entries + N×PNG payloads.
  // Each directory entry points at an offset where the PNG bytes live.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type = 1 (ICO)
  header.writeUInt16LE(SIZES.length, 4); // image count

  const directory = Buffer.alloc(SIZES.length * 16);
  let offset = header.length + directory.length;
  pngs.forEach((png, i) => {
    const sz = SIZES[i];
    const e = i * 16;
    directory.writeUInt8(sz === 256 ? 0 : sz, e + 0);     // width (0 = 256)
    directory.writeUInt8(sz === 256 ? 0 : sz, e + 1);     // height
    directory.writeUInt8(0, e + 2);                       // colour palette
    directory.writeUInt8(0, e + 3);                       // reserved
    directory.writeUInt16LE(1, e + 4);                    // planes
    directory.writeUInt16LE(32, e + 6);                   // bits per pixel
    directory.writeUInt32LE(png.length, e + 8);           // bytes in image
    directory.writeUInt32LE(offset, e + 12);              // offset of image data
    offset += png.length;
  });

  const ico = Buffer.concat([header, directory, ...pngs]);
  writeFileSync(ICO_PATH, ico);
  console.log(`✓ wrote ${ICO_PATH} (${ico.length} bytes, sizes: ${SIZES.join(', ')})`);
}

main().catch(e => { console.error(e); process.exit(1); });
