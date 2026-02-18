import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CalendarMode } from '@/types/domain';

const STORAGE_KEY = 'cheque-tracker-calendar-mode';

interface CalendarContextValue {
  calendarPreference: CalendarMode;
  setCalendarPreference: (mode: CalendarMode) => void;
  toggleCalendarPreference: () => void;
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  toggleMode: () => void;
}

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendarPreference, setCalendarPreference] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'AD' || saved === 'BS' ? saved : 'BS';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, calendarPreference);
  }, [calendarPreference]);

  const value = useMemo<CalendarContextValue>(
    () => ({
      calendarPreference,
      setCalendarPreference,
      toggleCalendarPreference: () =>
        setCalendarPreference((previousMode) => (previousMode === 'AD' ? 'BS' : 'AD')),
      mode: calendarPreference,
      setMode: setCalendarPreference,
      toggleMode: () =>
        setCalendarPreference((previousMode) => (previousMode === 'AD' ? 'BS' : 'AD')),
    }),
    [calendarPreference],
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
