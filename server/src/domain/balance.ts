/**
 * The double-entry core. A journal entry is valid only if it has at least two lines, every
 * line amount is a positive integer number of cents, and total debits === total credits.
 * Because money is integer cents, the balance check is exact — no rounding tolerance.
 */
export type Side = 'debit' | 'credit';

export interface LineInput {
  account_id: number;
  side: Side;
  amount_cents: number;
}

/** Returns an error message if the lines don't form a balanced entry, else null. */
export function validateBalanced(lines: LineInput[]): string | null {
  if (!Array.isArray(lines) || lines.length < 2) {
    return 'An entry needs at least two lines.';
  }
  let debits = 0;
  let credits = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.amount_cents) || l.amount_cents <= 0) {
      return 'Each line amount must be a positive number.';
    }
    if (l.side === 'debit') debits += l.amount_cents;
    else credits += l.amount_cents;
  }
  if (debits !== credits) {
    return `Entry is unbalanced: debits and credits must be equal (debits ${debits}c vs credits ${credits}c).`;
  }
  return null;
}
