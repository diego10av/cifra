import { describe, it, expect } from 'vitest';
import { parseInline, parseBlocks } from '@/components/chat/render-markdown';

describe('parseInline', () => {
  it('passes plain text through as a single text node', () => {
    const result = parseInline('hello world');
    expect(result).toEqual([{ kind: 'text', text: 'hello world' }]);
  });

  it('extracts [LEGAL_REF] as a legal node', () => {
    const result = parseInline('See [LTVA Art. 44] for details.');
    expect(result).toContainEqual({ kind: 'legal', text: 'LTVA Art. 44' });
    expect(result.some(n => n.kind === 'text' && /See/.test(n.text))).toBe(true);
    expect(result.some(n => n.kind === 'text' && /for details/.test(n.text))).toBe(true);
  });

  it('extracts **bold**', () => {
    const result = parseInline('This is **important** info');
    expect(result).toContainEqual({ kind: 'bold', text: 'important' });
  });

  it('extracts __bold__', () => {
    const result = parseInline('also __bold__');
    expect(result).toContainEqual({ kind: 'bold', text: 'bold' });
  });

  it('extracts `inline code`', () => {
    const result = parseInline('Use the `checkRateLimit` helper');
    expect(result).toContainEqual({ kind: 'code', text: 'checkRateLimit' });
  });

  it('handles all three inline transforms in one string', () => {
    const result = parseInline('See [LTVA Art. 44] and use **exemption** via `call()`.');
    const kinds = result.map(n => n.kind);
    expect(kinds).toContain('legal');
    expect(kinds).toContain('bold');
    expect(kinds).toContain('code');
  });

  it('does not treat unbracketed words in caps as legal refs', () => {
    const result = parseInline('LTVA Art. 44 is the primary basis');
    expect(result.some(n => n.kind === 'legal')).toBe(false);
  });

  it('does not greedily match across lines', () => {
    // Bold regex is single-line; * across newline should stay text
    const result = parseInline('first line\n**still open');
    expect(result.every(n => n.kind !== 'bold')).toBe(true);
  });

  it('treats stray single * as plain text', () => {
    const result = parseInline('a * b');
    expect(result).toEqual([{ kind: 'text', text: 'a * b' }]);
  });
});

describe('parseBlocks', () => {
  it('returns one paragraph for a plain string', () => {
    const blocks = parseBlocks('Just a sentence.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('paragraph');
  });

  it('splits on blank lines into separate paragraphs', () => {
    const blocks = parseBlocks('First paragraph.\n\nSecond paragraph.');
    expect(blocks).toHaveLength(2);
    expect(blocks.every(b => b.kind === 'paragraph')).toBe(true);
  });

  it('glues consecutive non-empty lines into one paragraph', () => {
    const blocks = parseBlocks('line one\nline two\nline three');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('paragraph');
  });

  it('detects a bulleted list', () => {
    const blocks = parseBlocks('- first\n- second\n- third');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('ul');
    if (blocks[0]!.kind === 'ul') {
      expect(blocks[0]!.items).toHaveLength(3);
    }
  });

  it('detects bullets with * and • too', () => {
    const blocks1 = parseBlocks('* one\n* two');
    const blocks2 = parseBlocks('• one\n• two');
    expect(blocks1[0]!.kind).toBe('ul');
    expect(blocks2[0]!.kind).toBe('ul');
  });

  it('detects a numbered list', () => {
    const blocks = parseBlocks('1. first\n2. second\n3. third');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('ol');
    if (blocks[0]!.kind === 'ol') {
      expect(blocks[0]!.items).toHaveLength(3);
    }
  });

  it('handles paragraph + list + paragraph', () => {
    const text = 'Intro.\n\n- a\n- b\n\nConclusion.';
    const blocks = parseBlocks(text);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]!.kind).toBe('paragraph');
    expect(blocks[1]!.kind).toBe('ul');
    expect(blocks[2]!.kind).toBe('paragraph');
  });

  it('preserves inline formatting inside list items', () => {
    const blocks = parseBlocks('- See [LTVA Art. 44]\n- Use **bold**');
    if (blocks[0]!.kind === 'ul') {
      const first = blocks[0]!.items[0]!;
      const second = blocks[0]!.items[1]!;
      expect(first.some(n => n.kind === 'legal')).toBe(true);
      expect(second.some(n => n.kind === 'bold')).toBe(true);
    }
  });

  it('returns an empty array for empty input', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('\n\n\n')).toEqual([]);
  });
});
