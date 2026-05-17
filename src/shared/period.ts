export interface Period {
  year: number;
  month: number;
}

export function periodFromDate(date: Date): Period {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

export function currentPeriod(): Period {
  return periodFromDate(new Date());
}

export function formatPeriod(period: Period): string {
  const mm = String(period.month).padStart(2, '0');
  return `${period.year}_${mm}`;
}

export function parsePeriod(input: string): Period {
  const match = /^(\d{4})_(\d{1,2})$/.exec(input);
  if (!match) {
    throw new Error(`Invalid period string: "${input}". Expected YYYY_MM.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month ${month} in period "${input}". Must be 1–12.`);
  }
  return { year, month };
}

export function isHistoricalPeriod(period: Period, reference: Period = currentPeriod()): boolean {
  if (period.year < reference.year) return true;
  if (period.year > reference.year) return false;
  return period.month < reference.month;
}
