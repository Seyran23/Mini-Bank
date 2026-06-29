import { ArrowLeftRight, Wallet } from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
] as const;
