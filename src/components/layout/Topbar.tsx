import type { CalendarMode } from '@/types/domain';

interface TopbarProps {
  mode: CalendarMode;
  onToggleMode: () => void;
  onSignOut: () => void;
}

export function Topbar({ mode, onToggleMode, onSignOut }: TopbarProps) {
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
