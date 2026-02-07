interface StatsCardsProps {
  currentBalance: number;
  projectedToday: number;
  pendingDeposits: number;
  pendingOutflows: number;
}

function currency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function StatsCards({
  currentBalance,
  projectedToday,
  pendingDeposits,
  pendingOutflows,
}: StatsCardsProps) {
  const cards = [
    {
      title: 'Current Balance (Cleared)',
      value: currency(currentBalance),
      className: 'text-brand-700',
    },
    {
      title: 'Projected Balance (Today)',
      value: currency(projectedToday),
      className: 'text-slate-900',
    },
    {
      title: 'Pending Deposits',
      value: currency(pendingDeposits),
      className: 'text-emerald-700',
    },
    {
      title: 'Pending Outflows',
      value: currency(pendingOutflows),
      className: 'text-rose-700',
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-slate-500">{card.title}</p>
          <p className={`mt-2 text-xl font-semibold ${card.className}`}>{card.value}</p>
        </article>
      ))}
    </section>
  );
}
