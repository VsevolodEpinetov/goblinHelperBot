import { escapeHtml } from '../../shared/format';

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
