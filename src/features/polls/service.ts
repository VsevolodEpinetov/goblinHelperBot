import { escapeHtml } from '../../shared/format';

/** A Telegram poll allows at most 10 options; we reserve the last slot for the
 * "empty" choice, so each poll holds up to 9 studios. */
export const POLL_MAX_STUDIOS = 9;
export const EMPTY_OPTION = 'Пустой вариант';

/**
 * Split studio names into ballots of <=9 studios, each capped with an "empty"
 * option (10 options total — Telegram's max). Mirrors the legacy launch: a
 * chunk is closed and the empty option appended once it reaches 9 studios, and
 * the final partial chunk gets the empty option too. Empty chunks are dropped,
 * so an exact multiple of 9 produces no trailing blank poll.
 */
export function buildPollChunks(studios: readonly string[]): string[][] {
  const chunks: string[][] = [[]];
  for (const studio of studios) {
    const current = chunks[chunks.length - 1]!;
    current.push(studio);
    if (current.length === POLL_MAX_STUDIOS) {
      current.push(EMPTY_OPTION);
      chunks.push([]);
    }
  }
  const last = chunks[chunks.length - 1]!;
  if (last.length > 0 && last[last.length - 1] !== EMPTY_OPTION) {
    last.push(EMPTY_OPTION);
  }
  return chunks.filter((c) => c.length > 0);
}

export function parseStudioName(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('http')) continue;
    if (line.startsWith('$') || line.startsWith('€')) continue;
    return line;
  }
  return undefined;
}

export interface PollLike {
  question: string;
  total_voter_count: number;
  options: ReadonlyArray<{ text: string; voter_count: number }>;
}

export function summarizePoll(poll: PollLike, totalChatMembers: number): string {
  const totalCount = Math.max(1, totalChatMembers);
  const lines: string[] = [];
  lines.push(`📝 Результаты <b>${escapeHtml(poll.question)}</b>`);
  lines.push('');
  lines.push(`<i>Всего проголосовало: ${poll.total_voter_count}</i>`);

  const notVoted = totalChatMembers - poll.total_voter_count;
  if (notVoted > 0) {
    lines.push(`<i>Ждём ещё ${notVoted} участников</i>`);
  }

  for (const opt of poll.options) {
    if (opt.text === 'Пустой вариант') continue;
    const percent = Math.ceil((opt.voter_count / totalCount) * 100);
    const label = escapeHtml(opt.text.split(' - ')[0] ?? opt.text);
    lines.push('');
    lines.push(`${label} - ${percent}%`);
  }

  return lines.join('\n');
}
