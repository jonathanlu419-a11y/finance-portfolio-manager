import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import BalancesPage from './pages/BalancesPage';
import JournalPage from './pages/JournalPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/balances" element={<BalancesPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
