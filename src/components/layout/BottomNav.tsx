import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  LayoutDashboard,
  List,
  Receipt,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface MobileNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Transactions', to: '/transactions', icon: List },
  { label: 'Cheques', to: '/cheques', icon: Receipt },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <ul
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${MOBILE_NAV_ITEMS.length}, minmax(0, 1fr))`,
        }}
      >
        {MOBILE_NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `mx-1 my-1 flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500'
                }`
              }
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              <span className="leading-none">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
