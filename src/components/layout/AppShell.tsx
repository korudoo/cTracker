import { Outlet, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAuth } from '@/context/AuthContext';
import { useCalendar } from '@/context/CalendarContext';
import { useStatusTransition } from '@/hooks/useStatusTransition';

export function AppShell() {
  const { user, signOut } = useAuth();
  const { mode, toggleMode } = useCalendar();
  const navigate = useNavigate();

  useStatusTransition(Boolean(user));

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar mode={mode} onToggleMode={toggleMode} onSignOut={handleSignOut} />

      <div className="flex">
        <Sidebar />

        <main className="w-full px-4 py-6 pb-24 sm:px-6 md:pb-6">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
