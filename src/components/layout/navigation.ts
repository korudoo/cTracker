export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Transactions', to: '/transactions' },
  { label: 'Settings', to: '/settings' },
];
