import { useEffect, useState } from 'react';
import type { CalendarMode } from '@/types/domain';
import { formatInputDateForMode, parseInputDateToAd } from '@/utils/nepaliDate';

interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  mode: CalendarMode;
  onChange: (nextAdIso: string) => void;
  required?: boolean;
}

export function DateField({ id, label, value, mode, onChange, required = false }: DateFieldProps) {
  const [rawBsValue, setRawBsValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRawBsValue(formatInputDateForMode(value, mode));
    setError(null);
  }, [mode, value]);

  const renderInput = () => {
    if (mode === 'AD') {
      return (
        <input
          id={id}
          type="date"
          value={value}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      );
    }

    return (
      <input
        id={id}
        type="text"
        value={rawBsValue}
        required={required}
        placeholder="YYYY-MM-DD"
        onChange={(event) => {
          const nextValue = event.target.value;
          setRawBsValue(nextValue);

          if (!nextValue) {
            setError(null);
            onChange('');
            return;
          }

          const adDate = parseInputDateToAd(nextValue, 'BS');

          if (!adDate) {
            setError('Invalid BS date. Use YYYY-MM-DD.');
            return;
          }

          setError(null);
          onChange(adDate);
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    );
  };

  return (
    <label htmlFor={id} className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {renderInput()}
      {mode === 'BS' ? <p className="text-xs text-slate-500">Displayed in Bikram Sambat.</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </label>
  );
}
