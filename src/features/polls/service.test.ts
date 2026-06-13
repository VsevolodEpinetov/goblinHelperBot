import { describe, expect, it } from 'vitest';

import { parseStudioName, summarizePoll } from './service';

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
