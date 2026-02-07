export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Calendar', to: '/calendar' },
  { label: 'Transactions', to: '/transactions' },
  { label: 'Alerts', to: '/notifications' },
  { label: 'Settings', to: '/settings' },
];
