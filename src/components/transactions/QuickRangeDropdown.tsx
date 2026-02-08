import type { QuickRangeValue } from '@/utils/quickRanges';

interface QuickRangeDropdownProps {
  value: QuickRangeValue;
  onChange: (value: QuickRangeValue) => void;
}

export function QuickRangeDropdown({ value, onChange }: QuickRangeDropdownProps) {
  return (
    <label className="block min-w-44 space-y-1">
      <span className="text-sm font-medium text-slate-700">Quick Range</span>
      <select
        aria-label="Quick range"
        value={value}
        onChange={(event) => onChange(event.target.value as QuickRangeValue)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <option value="">Select quick range</option>
        <option value="lastWeek">Last week</option>
        <option value="lastMonth">Last month</option>
        <option value="thisMonth">This month</option>
        <option value="nextWeek">Next week</option>
        <option value="nextMonth">Next month</option>
        <option value="custom">Custom</option>
      </select>
    </label>
  );
}
