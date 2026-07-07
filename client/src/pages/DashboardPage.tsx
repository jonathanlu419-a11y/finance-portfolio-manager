/**
 * Dashboard — the "/" home. Everything is computed client-side from the two existing
 * queries (balances + entries); no new endpoints, tables, or npm dependencies.
 * The donut is plain SVG (stroke-dasharray arc segments); the category/income bars are
 * plain divs whose widths are proportional to the largest row.
 */
import { useMemo, useState } from 'react';
import { useBalances, useEntries } from '../api/hooks';
import type { JournalEntry } from '../api/types';
import { formatCents } from '../lib/money';
import KpiCards from '../components/KpiCards';

// Theme-adjacent palette for donut segments (cycled if more accounts than colors).
const PALETTE = ['#4f8cff', '#38c172', '#fcd34d', '#7dd3fc', '#f472b6', '#fb923c', '#a78bfa', '#ef5350'];

type Window = 'month' | '30d' | 'all';
const WINDOW_LABELS: Record<Window, string> = { month: 'This Month', '30d': '30 Days', all: 'All Time' };

function inWindow(dateISO: string, w: Window): boolean {
  if (w === 'all') return true;
  const now = new Date();
  if (w === 'month') {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return dateISO.startsWith(ym);
  }
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
  return dateISO >= cutoff;
}

/** Sum matching lines grouped by a header label (category / income source). */
function groupSums(
  entries: JournalEntry[],
  w: Window,
  nature: 'Expense' | 'Revenue',
  side: 'debit' | 'credit',
  labelOf: (e: JournalEntry) => string,
): { label: string; cents: number }[] {
  const buckets = new Map<string, number>();
  for (const e of entries) {
    if (!inWindow(e.entry_date, w)) continue;
    for (const l of e.lines) {
      if (l.account_nature !== nature || l.side !== side) continue;
      const label = labelOf(e);
      buckets.set(label, (buckets.get(label) ?? 0) + l.amount_cents);
    }
  }
  return [...buckets.entries()]
    .map(([label, cents]) => ({ label, cents }))
    .sort((a, b) => b.cents - a.cents);
}

/** Rows with a proportional bar under each (widths relative to the largest row). */
function BarList({ rows, color }: { rows: { label: string; cents: number }[]; color: string }) {
  if (rows.length === 0) return <p className="muted center">Nothing in this window.</p>;
  const max = rows[0].cents || 1;
  return (
    <div className="bar-list">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <div className="bar-row-head">
            <span>{r.label}</span>
            <span className="mono">{formatCents(r.cents)}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.cents / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** SVG donut from stroke-dasharray arc segments. */
function Donut({ segments }: { segments: { label: string; cents: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.cents, 0);
  const R = 60;
  const C = 2 * Math.PI * R;
  let cum = 0;
  return (
    <svg viewBox="0 0 160 160" className="donut" role="img" aria-label="Asset allocation">
      {segments.map((s) => {
        const frac = s.cents / total;
        const el = (
          <circle
            key={s.label}
            cx="80" cy="80" r={R} fill="none"
            stroke={s.color} strokeWidth="24"
            strokeDasharray={`${frac * C} ${C}`}
            strokeDashoffset={-cum * C}
            transform="rotate(-90 80 80)"
          />
        );
        cum += frac;
        return el;
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const { data: balances = [], isLoading: balLoading } = useBalances();
  const { data: entries = [], isLoading: entLoading } = useEntries();
  const [win, setWin] = useState<Window>('month');

  const assets = useMemo(() => balances.filter((a) => a.nature === 'Asset'), [balances]);

  // Donut can only draw positive slices; non-positive assets stay in the balances card.
  const donutSegments = useMemo(() => {
    const positive = assets.filter((a) => a.balance_cents > 0);
    return positive.map((a, i) => ({ label: a.name, cents: a.balance_cents, color: PALETTE[i % PALETTE.length] }));
  }, [assets]);
  const donutTotal = donutSegments.reduce((s, x) => s + x.cents, 0);

  const spending = useMemo(
    () => groupSums(entries, win, 'Expense', 'debit', (e) => e.category_name ?? 'Uncategorized'),
    [entries, win],
  );
  const income = useMemo(
    () => groupSums(entries, win, 'Revenue', 'credit', (e) => e.income_source_name ?? 'Other'),
    [entries, win],
  );

  if (balLoading || entLoading) {
    return <div className="page"><h1>Dashboard</h1><p className="muted">Loading…</p></div>;
  }

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="win-toggle">
          {(Object.keys(WINDOW_LABELS) as Window[]).map((w) => (
            <button key={w} className={w === win ? 'tab active' : 'tab'} onClick={() => setWin(w)}>
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      <KpiCards balances={balances} />

      <div className="dash-grid">
        <div className="card">
          <h3 className="card-title">Asset Allocation</h3>
          {donutSegments.length === 0 ? (
            <p className="muted center">No positive asset balances.</p>
          ) : (
            <div className="donut-wrap">
              <Donut segments={donutSegments} />
              <div className="donut-legend">
                {donutSegments.map((s) => (
                  <div className="legend-row" key={s.label}>
                    <span className="legend-swatch" style={{ background: s.color }} />
                    <span className="legend-name">{s.label}</span>
                    <span className="mono muted">{formatCents(s.cents)}</span>
                    <span className="mono legend-pct">{((s.cents / donutTotal) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Bank Accounts</h3>
          <table className="table compact">
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="mono muted nowrap">{a.code ?? '—'}</td>
                  <td>{a.name}</td>
                  <td className="right mono">{formatCents(a.balance_cents)}</td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td className="muted center">No asset accounts.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="card-title">Top Spending <span className="muted card-title-sub">{WINDOW_LABELS[win]}</span></h3>
          <BarList rows={spending} color="var(--danger)" />
        </div>

        <div className="card">
          <h3 className="card-title">Income Sources <span className="muted card-title-sub">{WINDOW_LABELS[win]}</span></h3>
          <BarList rows={income} color="var(--success)" />
        </div>
      </div>
    </div>
  );
}
