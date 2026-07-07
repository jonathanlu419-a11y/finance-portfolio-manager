import { useMemo } from 'react';
import { useBalances } from '../api/hooks';
import { ACCOUNT_NATURES, type AccountBalance, type AccountNature } from '../api/types';
import { formatCents } from '../lib/money';

const NATURE_BLURB: Record<AccountNature, string> = {
  Asset: 'What you own',
  Liability: 'What you owe',
  Revenue: 'Income earned',
  Expense: 'Money spent',
};

/** Nature-grouped account grid. The headline KPI cards live on the Dashboard. */
export default function BalancesPage() {
  const { data: balances = [], isLoading } = useBalances();

  const byNature = useMemo(() => {
    const map = {} as Record<AccountNature, AccountBalance[]>;
    for (const n of ACCOUNT_NATURES) map[n] = [];
    for (const b of balances) map[b.nature].push(b);
    return map;
  }, [balances]);

  if (isLoading) return <div className="page"><h1>Account Balances</h1><p className="muted">Loading…</p></div>;

  return (
    <div className="page wide">
      <h1>Account Balances</h1>

      <div className="nature-grid">
        {ACCOUNT_NATURES.map((nature) => {
          const rows = byNature[nature];
          const groupTotal = rows.reduce((s, a) => s + a.balance_cents, 0);
          return (
            <div className="card" key={nature}>
              <div className="group-head">
                <div>
                  <span className={`badge nature-${nature.toLowerCase()}`}>{nature}</span>
                  <span className="muted group-blurb">{NATURE_BLURB[nature]}</span>
                </div>
                <span className="mono group-total">{formatCents(groupTotal)}</span>
              </div>
              <table className="table compact">
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td className="mono muted nowrap">{a.code ?? '—'}</td>
                      <td>{a.name}</td>
                      <td className="right mono">{formatCents(a.balance_cents)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={3} className="muted center">No {nature.toLowerCase()} accounts.</td></tr>}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
