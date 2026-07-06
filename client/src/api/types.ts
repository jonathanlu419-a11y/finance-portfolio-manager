export type AccountNature = 'Asset' | 'Liability' | 'Revenue' | 'Expense';
export const ACCOUNT_NATURES: AccountNature[] = ['Asset', 'Liability', 'Revenue', 'Expense'];

export interface Account {
  id: number;
  code: string | null;
  name: string;
  nature: AccountNature;
  starting_balance_cents: number;
  created_at: string;
}

export interface Lookup {
  id: number;
  name: string;
}
export type Category = Lookup;
export type IncomeSource = Lookup;

export type ShortcutKind = 'expense' | 'income' | 'transfer' | 'card_payment';
export const SHORTCUT_KINDS: ShortcutKind[] = ['expense', 'income', 'transfer', 'card_payment'];
export const SHORTCUT_KIND_LABELS: Record<ShortcutKind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  card_payment: 'Card Payment',
};

export interface Shortcut {
  id: number;
  label: string;
  icon: string | null;
  kind: ShortcutKind;
  default_account_id: number | null;
  default_counter_account_id: number | null;
  default_category_id: number | null;
  default_income_source_id: number | null;
  sort_order: number;
}

export type Side = 'debit' | 'credit';

export interface JournalLine {
  id: number;
  account_id: number;
  account_name: string;
  account_nature: AccountNature;
  side: Side;
  amount_cents: number;
}

export interface JournalEntry {
  id: number;
  entry_date: string;
  description: string | null;
  payee: string | null;
  category_id: number | null;
  income_source_id: number | null;
  category_name: string | null;
  income_source_name: string | null;
  lines: JournalLine[];
}
