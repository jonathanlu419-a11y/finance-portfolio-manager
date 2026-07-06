import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Account, Category, IncomeSource, JournalEntry, Shortcut, Side } from './types';

// ── Query keys ────────────────────────────────────────────────────────────────
export const qk = {
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  incomeSources: ['income-sources'] as const,
  shortcuts: ['shortcuts'] as const,
  entries: ['entries'] as const,
};

function invalidate(qc: QueryClient, keys: readonly (readonly string[])[]): void {
  for (const key of keys) qc.invalidateQueries({ queryKey: key });
}

// ── Accounts ────────────────────────────────────────────────────────────────
export type AccountInput = Pick<Account, 'code' | 'name' | 'nature' | 'starting_balance_cents'>;

export const useAccounts = () => useQuery({ queryKey: qk.accounts, queryFn: () => api.get<Account[]>('/accounts') });

export function useSaveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id?: number; data: AccountInput }) =>
      v.id ? api.put<Account>(`/accounts/${v.id}`, v.data) : api.post<Account>('/accounts', v.data),
    onSuccess: () => invalidate(qc, [qk.accounts, qk.shortcuts]),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/accounts/${id}`),
    onSuccess: () => invalidate(qc, [qk.accounts, qk.shortcuts]),
  });
}

// ── Categories & Income Sources (identical shape) ─────────────────────────────
export const useCategories = () =>
  useQuery({ queryKey: qk.categories, queryFn: () => api.get<Category[]>('/categories') });
export const useIncomeSources = () =>
  useQuery({ queryKey: qk.incomeSources, queryFn: () => api.get<IncomeSource[]>('/income-sources') });

function makeLookupMutations(path: string, key: readonly string[]) {
  return {
    useSave() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (v: { id?: number; name: string }) =>
          v.id ? api.put(`/${path}/${v.id}`, { name: v.name }) : api.post(`/${path}`, { name: v.name }),
        onSuccess: () => invalidate(qc, [key, qk.shortcuts]),
      });
    },
    useDelete() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: number) => api.del(`/${path}/${id}`),
        onSuccess: () => invalidate(qc, [key, qk.shortcuts]),
      });
    },
  };
}

const categoryMut = makeLookupMutations('categories', qk.categories);
const incomeSourceMut = makeLookupMutations('income-sources', qk.incomeSources);
export const useSaveCategory = categoryMut.useSave;
export const useDeleteCategory = categoryMut.useDelete;
export const useSaveIncomeSource = incomeSourceMut.useSave;
export const useDeleteIncomeSource = incomeSourceMut.useDelete;

// ── Shortcuts ─────────────────────────────────────────────────────────────────
export type ShortcutInput = Pick<
  Shortcut,
  | 'label'
  | 'icon'
  | 'kind'
  | 'default_account_id'
  | 'default_counter_account_id'
  | 'default_category_id'
  | 'default_income_source_id'
>;

export const useShortcuts = () =>
  useQuery({ queryKey: qk.shortcuts, queryFn: () => api.get<Shortcut[]>('/shortcuts') });

export function useSaveShortcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id?: number; data: ShortcutInput }) =>
      v.id ? api.put<Shortcut>(`/shortcuts/${v.id}`, v.data) : api.post<Shortcut>('/shortcuts', v.data),
    onSuccess: () => invalidate(qc, [qk.shortcuts]),
  });
}

export function useDeleteShortcut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/shortcuts/${id}`),
    onSuccess: () => invalidate(qc, [qk.shortcuts]),
  });
}

export function useReorderShortcuts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => api.post('/shortcuts/reorder', { ids }),
    onSuccess: () => invalidate(qc, [qk.shortcuts]),
  });
}

// ── Journal entries ─────────────────────────────────────────────────────────
export interface EntryLineInput {
  account_id: number;
  side: Side;
  amount_cents: number;
}
export interface EntryInput {
  entry_date: string;
  description: string | null;
  payee: string | null;
  category_id: number | null;
  income_source_id: number | null;
  lines: EntryLineInput[];
}

export const useEntries = () =>
  useQuery({ queryKey: qk.entries, queryFn: () => api.get<JournalEntry[]>('/entries') });

export function useSaveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id?: number; data: EntryInput }) =>
      v.id ? api.put<JournalEntry>(`/entries/${v.id}`, v.data) : api.post<JournalEntry>('/entries', v.data),
    onSuccess: () => invalidate(qc, [qk.entries]),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/entries/${id}`),
    onSuccess: () => invalidate(qc, [qk.entries]),
  });
}
