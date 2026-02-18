type SortDirection = 'asc' | 'desc';

interface TableSortHeaderProps<TSortKey extends string> {
  label: string;
  sortKey: TSortKey;
  activeSortKey: TSortKey;
  direction: SortDirection;
  onToggle: (sortKey: TSortKey) => void;
  className?: string;
}

export function TableSortHeader<TSortKey extends string>({
  label,
  sortKey,
  activeSortKey,
  direction,
  onToggle,
  className,
}: TableSortHeaderProps<TSortKey>) {
  const isActive = sortKey === activeSortKey;
  const arrow = isActive ? (direction === 'asc' ? '↑' : '↓') : null;
  const nextDirectionLabel = isActive && direction === 'asc' ? 'descending' : 'ascending';

  return (
    <th className={className ?? 'py-2 pr-4 font-medium'} scope="col">
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className="inline-flex items-center gap-1 text-left hover:text-slate-700"
        aria-label={`Sort by ${label} (${nextDirectionLabel})`}
      >
        <span>{label}</span>
        {arrow ? (
          <span aria-hidden="true" className="text-xs">
            {arrow}
          </span>
        ) : null}
      </button>
    </th>
  );
}
