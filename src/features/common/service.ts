const MAX_DICE = 1_000_000;

export function rollDice(max: number): number {
  if (!Number.isInteger(max)) throw new Error('max must be an integer');
  if (max < 1) throw new Error('max must be >= 1');
  if (max > MAX_DICE) throw new Error(`max exceeds maximum (${MAX_DICE})`);
  return Math.floor(Math.random() * max) + 1;
}
