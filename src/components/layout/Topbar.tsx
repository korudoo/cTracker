import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/components/layout/navigation';
import { Bell, LogOut } from 'lucide-react';
import type { CalendarMode } from '@/types/domain';

interface TopbarProps {
  mode: CalendarMode;
  unreadCount: number;
  onToggleMode: () => void;
  onOpenNotifications: () => void;
  onSignOut: () => void;
}

export function Topbar({
  mode,
  unreadCount,
  onToggleMode,
  onOpenNotifications,
  onSignOut,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex min-h-14 items-center justify-between gap-2 px-4 py-2 sm:min-h-16 sm:gap-3 sm:px-6">
        <h1 className="text-base font-semibold text-slate-900 sm:text-lg">Cheque Tracker</h1>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 text-sm font-medium ${
                  isActive
                    ? 'bg-brand-100 text-brand-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onToggleMode}
            className="h-9 rounded-full border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-700"
          >
            <span className="sm:hidden">{mode}</span>
            <span className="hidden sm:inline">{mode} Calendar</span>
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 sm:hidden"
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative hidden rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex"
            aria-label="Open notifications"
          >
            Bell
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 sm:hidden"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="hidden rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
