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
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Cheque Tracker</h1>
          <p className="text-xs text-slate-500">Track cheques, deposits, and withdrawals</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMode}
            className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
          >
            {mode} Calendar
          </button>
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
