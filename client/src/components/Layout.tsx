import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, BookOpen, Settings as SettingsIcon, RotateCcw, Eraser } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import QuickAdd from './QuickAdd';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/balances', label: 'Balances', icon: Wallet, end: false },
  { to: '/journal', label: 'Journal', icon: BookOpen, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export default function Layout({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'reset' | 'empty' | null>(null);

  async function wipe(kind: 'reset' | 'empty') {
    const msg =
      kind === 'reset'
        ? 'Reset demo data? This wipes your current data and restores the starter set.'
        : 'Empty ALL data for this session? You will start from a completely blank slate (no accounts, no entries).';
    if (!window.confirm(msg)) return;
    setBusy(kind);
    try {
      await api.post('/session/reset', kind === 'empty' ? { empty: true } : undefined);
      await qc.invalidateQueries(); // refetch everything
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Your Finance Manager</div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <n.icon size={16} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="btn ghost" onClick={() => wipe('reset')} disabled={busy !== null} title="Wipe and re-seed this session's demo data">
          <RotateCcw size={15} />
          <span>{busy === 'reset' ? 'Resetting…' : 'Reset demo'}</span>
        </button>
        <button className="btn ghost" onClick={() => wipe('empty')} disabled={busy !== null} title="Wipe this session to a completely blank slate (no re-seed)">
          <Eraser size={15} />
          <span>{busy === 'empty' ? 'Emptying…' : 'Empty data'}</span>
        </button>
      </header>
      <main className="main">{children}</main>
      <QuickAdd />
    </div>
  );
}
