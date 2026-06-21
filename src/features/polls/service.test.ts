import { describe, expect, it } from 'vitest';

import { buildPollChunks, EMPTY_OPTION, parseStudioName, summarizePoll } from './service';

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `Studio ${i + 1}`);

describe('polls.service.buildPollChunks', () => {
  it('returns no chunks for an empty ballot', () => {
    expect(buildPollChunks([])).toEqual([]);
  });

  it('puts a small ballot in one chunk capped with the empty option', () => {
    const chunks = buildPollChunks(names(5));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(6);
    expect(chunks[0]?.at(-1)).toBe(EMPTY_OPTION);
  });

  it('fits exactly 9 studios into a single 10-option poll with no trailing blank', () => {
    const chunks = buildPollChunks(names(9));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[0]?.at(-1)).toBe(EMPTY_OPTION);
  });

  it('splits 10 studios into two polls (9+empty, 1+empty)', () => {
    const chunks = buildPollChunks(names(10));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toEqual(['Studio 10', EMPTY_OPTION]);
  });

  it('produces no trailing empty poll for an exact multiple of 9', () => {
    const chunks = buildPollChunks(names(18));
    expect(chunks).toHaveLength(2);
    expect(chunks.every((c) => c.length === 10)).toBe(true);
    expect(chunks.every((c) => c.at(-1) === EMPTY_OPTION)).toBe(true);
  });
});

describe('polls.service.parseStudioName', () => {
  it('returns the trimmed first non-link non-price line', () => {
    expect(parseStudioName('Studio A\nhttps://example.com\n$100')).toBe('Studio A');
  });

  it('skips lines starting with http', () => {
    expect(parseStudioName('http://x\nReal Studio')).toBe('Real Studio');
  });

  it('skips lines starting with $ or €', () => {
    expect(parseStudioName('$50\n€60\nWith Name')).toBe('With Name');
  });

  it('trims whitespace', () => {
    expect(parseStudioName('   Studio B   ')).toBe('Studio B');
  });

  it('returns undefined if no valid line is found', () => {
    expect(parseStudioName('http://only\n$only')).toBeUndefined();
  });
});

describe('polls.service.summarizePoll', () => {
  it('formats a HTML summary with percentages', () => {
    const result = summarizePoll(
      {
        question: 'Best studio?',
        total_voter_count: 10,
        options: [
          { text: 'Studio A - some descr', voter_count: 5 },
          { text: 'Studio B - other', voter_count: 3 },
          { text: 'Пустой вариант', voter_count: 2 },
        ],
      },
      10,
    );
    expect(result).toContain('Best studio?');
    expect(result).toContain('Studio A');
    expect(result).toContain('Studio B');
    expect(result).not.toContain('Пустой вариант');
    expect(result).toContain('50%');
    expect(result).toContain('30%');
  });

  it('shows the computed not-voted count while votes are missing', () => {
    const result = summarizePoll({ question: 'q', total_voter_count: 4, options: [] }, 10);
    expect(result).toMatch(/\b6\b/);
  });

  it('omits the not-voted line when everyone voted', () => {
    const pending = summarizePoll({ question: 'q', total_voter_count: 4, options: [] }, 10);
    const done = summarizePoll({ question: 'q', total_voter_count: 10, options: [] }, 10);
    expect(done).not.toMatch(/\b6\b/);
    expect(pending.split('\n')).toHaveLength(done.split('\n').length + 1);
  });

  it('escapes HTML in the question and option labels', () => {
    const result = summarizePoll(
      {
        question: '<b>evil & co</b>',
        total_voter_count: 1,
        options: [{ text: 'A<1> & B - descr', voter_count: 1 }],
      },
      1,
    );
    expect(result).toContain('<b>&lt;b&gt;evil &amp; co&lt;/b&gt;</b>');
    expect(result).toContain('A&lt;1&gt; &amp; B');
    expect(result).not.toContain('<b>evil');
  });
});
