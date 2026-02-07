import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/components/layout/navigation';

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white md:hidden">
      <ul className="grid grid-cols-3">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-3 text-center text-xs font-semibold ${
                  isActive ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
