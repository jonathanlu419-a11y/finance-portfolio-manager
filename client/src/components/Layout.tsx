import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, BookOpen, Settings as SettingsIcon, RotateCcw } from 'lucide-react';
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
  const [resetting, setResetting] = useState(false);

  async function resetDemo() {
    if (!window.confirm('Reset demo data? This wipes your current data and restores the starter set.')) return;
    setResetting(true);
    try {
      await api.post('/session/reset');
      await qc.invalidateQueries(); // refetch everything
    } finally {
      setResetting(false);
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
        <button className="btn ghost" onClick={resetDemo} disabled={resetting} title="Wipe and re-seed this session's demo data">
          <RotateCcw size={15} />
          <span>{resetting ? 'Resetting…' : 'Reset demo'}</span>
        </button>
      </header>
      <main className="main">{children}</main>
      <QuickAdd />
    </div>
  );
}
