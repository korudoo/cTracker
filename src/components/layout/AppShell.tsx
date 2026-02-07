import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAuth } from '@/context/AuthContext';
import { useCalendar } from '@/context/CalendarContext';
import { useStatusTransition } from '@/hooks/useStatusTransition';
import { getUnreadInAppNotificationCount } from '@/services/notifications';

export function AppShell() {
  const { user, signOut } = useAuth();
  const { mode, toggleMode } = useCalendar();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useStatusTransition(Boolean(user));

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadInAppNotificationCount();
      setUnreadCount(count);
    } catch {
      // keep UI usable even if notification fetch fails
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    void loadUnreadCount();

    if (!user) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadUnreadCount, location.pathname, user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar
        mode={mode}
        unreadCount={unreadCount}
        onToggleMode={toggleMode}
        onOpenNotifications={() => navigate('/notifications')}
        onSignOut={handleSignOut}
      />

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
