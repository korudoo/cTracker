import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/components/layout/navigation';

export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-slate-200 bg-white md:block">
      <div className="px-4 py-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Navigation</p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
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
      </div>
    </aside>
  );
}
