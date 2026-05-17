const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

export type Currency = 'XTR' | 'RUB' | 'USD' | 'EUR';

const CURRENCY_SYMBOL: Record<Currency, string> = {
  XTR: '⭐',
  RUB: '₽',
  USD: '$',
  EUR: '€',
};

export function formatPrice(amount: number, currency: Currency): string {
  let formatted: string;
  if (amount >= 10000) {
    formatted = amount.toLocaleString('ru-RU').replace(/[\s,]/g, ' ');
  } else {
    formatted = String(amount);
  }
  return `${formatted} ${CURRENCY_SYMBOL[currency]}`;
}

export interface UserDisplayInput {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function formatUserDisplay(user: UserDisplayInput): string {
  if (user.username && user.username !== 'not_set') {
    return `@${user.username}`;
  }
  const parts = [user.firstName, user.lastName].filter((p): p is string => Boolean(p));
  if (parts.length > 0) {
    return parts.join(' ');
  }
  return `id:${user.id}`;
}
