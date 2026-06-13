import { describe, expect, it } from 'vitest';

import { validateCost, validateLink, validateName } from './service';

describe('kickstarters.service.validateName', () => {
  it('trims and returns', () => {
    expect(validateName('  Foo  ')).toBe('Foo');
  });
  it('throws on empty', () => {
    expect(() => validateName('')).toThrow();
  });
  it('throws on too long', () => {
    expect(() => validateName('a'.repeat(300))).toThrow();
  });
});

describe('kickstarters.service.validateCost', () => {
  it('parses integers and returns positive numbers', () => {
    expect(validateCost('1500')).toBe(1500);
  });
  it('rejects non-numeric', () => {
    expect(() => validateCost('abc')).toThrow();
  });
  it('rejects negative', () => {
    expect(() => validateCost('-1')).toThrow();
  });
  it('rejects zero', () => {
    expect(() => validateCost('0')).toThrow();
  });
});

describe('kickstarters.service.validateLink', () => {
  it('accepts http(s) URLs', () => {
    expect(validateLink('https://example.com')).toBe('https://example.com');
  });
  it('treats "пропустить" as null', () => {
    expect(validateLink('пропустить')).toBeNull();
  });
  it('rejects non-URL strings', () => {
    expect(() => validateLink('not-a-url')).toThrow();
  });
});
