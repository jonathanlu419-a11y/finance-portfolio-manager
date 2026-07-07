import { useMemo } from 'react';
import type { AccountBalance, AccountNature } from '../api/types';
import { formatCents } from '../lib/money';

/** The four headline KPI cards (Net worth / Assets / Liabilities / Net income),
 *  computed from the balances payload. Shared by the Dashboard (and formerly Balances). */
export default function KpiCards({ balances }: { balances: AccountBalance[] }) {
  const totals = useMemo(() => {
    const sum = (n: AccountNature) =>
      balances.filter((a) => a.nature === n).reduce((s, a) => s + a.balance_cents, 0);
    const assets = sum('Asset');
    const liabilities = sum('Liability');
    const revenue = sum('Revenue');
    const expense = sum('Expense');
    return { assets, liabilities, netWorth: assets - liabilities, netIncome: revenue - expense };
  }, [balances]);

  return (
    <div className="kpi-row">
      <div className="kpi">
        <div className="kpi-label">Net worth</div>
        <div className={`kpi-value ${totals.netWorth >= 0 ? 'pos' : 'neg'}`}>{formatCents(totals.netWorth)}</div>
        <div className="kpi-sub">Assets − Liabilities</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Total assets</div>
        <div className="kpi-value">{formatCents(totals.assets)}</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Total liabilities</div>
        <div className="kpi-value">{formatCents(totals.liabilities)}</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Net income</div>
        <div className={`kpi-value ${totals.netIncome >= 0 ? 'pos' : 'neg'}`}>{formatCents(totals.netIncome)}</div>
        <div className="kpi-sub">Revenue − Expense</div>
      </div>
    </div>
  );
}
