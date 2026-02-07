import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CalendarMode } from '@/types/domain';

const STORAGE_KEY = 'cheque-tracker-calendar-mode';

interface CalendarContextValue {
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  toggleMode: () => void;
}

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'BS' ? 'BS' : 'AD';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo<CalendarContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((previousMode) => (previousMode === 'AD' ? 'BS' : 'AD')),
    }),
    [mode],
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
}
