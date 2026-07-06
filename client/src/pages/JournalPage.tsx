import { useState } from 'react';
import { Plus, Pencil, Trash2, FileDown } from 'lucide-react';
import { useEntries, useDeleteEntry } from '../api/hooks';
import type { JournalEntry } from '../api/types';
import { formatCents } from '../lib/money';
import JournalEntryForm from './journal/JournalEntryForm';

/** "Chequing → Groceries" style flow summary from an entry's lines. */
function flow(e: JournalEntry): string {
  const debits = e.lines.filter((l) => l.side === 'debit').map((l) => l.account_name);
  const credits = e.lines.filter((l) => l.side === 'credit').map((l) => l.account_name);
  const left = debits.join(', ') || '—';
  const right = credits.join(', ') || '—';
  return `${left} ← ${right}`;
}

/** Entry total = sum of the debit side (equals the credit side for a balanced entry). */
function total(e: JournalEntry): number {
  return e.lines.filter((l) => l.side === 'debit').reduce((s, l) => s + l.amount_cents, 0);
}

export default function JournalPage() {
  const { data: entries = [], isLoading } = useEntries();
  const del = useDeleteEntry();
  const [form, setForm] = useState<{ open: boolean; entry: JournalEntry | null }>({ open: false, entry: null });

  async function remove(e: JournalEntry) {
    if (!window.confirm(`Delete this entry from ${e.entry_date}?`)) return;
    await del.mutateAsync(e.id);
  }

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Journal Entries</h1>
        <div className="row-actions">
          <button className="btn ghost" disabled title="CSV import — built in the next step"><FileDown size={15} /> Import CSV</button>
          <button className="btn primary" onClick={() => setForm({ open: true, entry: null })}><Plus size={15} /> New entry</button>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Flow (Dr ← Cr)</th>
                <th className="right">Amount</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="mono nowrap">{e.entry_date}</td>
                  <td>
                    {e.description || <span className="muted">—</span>}
                    {e.payee && <div className="sub muted">{e.payee}</div>}
                  </td>
                  <td>{e.category_name ? <span className="badge">{e.category_name}</span> : <span className="muted">—</span>}</td>
                  <td className="muted">{flow(e)}</td>
                  <td className="right mono">{formatCents(total(e))}</td>
                  <td className="right nowrap">
                    <button className="icon-btn" onClick={() => setForm({ open: true, entry: e })} aria-label="Edit"><Pencil size={15} /></button>
                    <button className="icon-btn danger" onClick={() => remove(e)} aria-label="Delete"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={6} className="muted center">No journal entries yet. Create one to get started.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {form.open && <JournalEntryForm entry={form.entry} onClose={() => setForm({ open: false, entry: null })} />}
    </div>
  );
}
