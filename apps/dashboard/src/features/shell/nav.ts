import {
  BookOpen,
  Bot,
  CalendarCheck,
  ChartColumn,
  CreditCard,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  Plug,
  Settings,
  Shield,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type SectionKey =
  | 'overview'
  | 'inbox'
  | 'customers'
  | 'orders'
  | 'reservations'
  | 'knowledge'
  | 'bots'
  | 'playground'
  | 'connect'
  | 'analytics'
  | 'billing'
  | 'settings'
  | 'admin';

export interface NavItem {
  key: SectionKey;
  /** Path under /w/:slug ('' = overview). */
  path: string;
  icon: LucideIcon;
  /** Built in a later phase: renders the "coming soon" state. */
  comingSoon: boolean;
}

export interface NavGroup {
  key: 'operate' | 'assistant' | 'grow' | 'manage';
  items: NavItem[];
}

/** Every product section from MASTER_PROMPT §12, in the order a team uses them. */
export const NAV: NavGroup[] = [
  {
    key: 'operate',
    items: [
      { key: 'overview', path: '', icon: LayoutDashboard, comingSoon: true },
      { key: 'inbox', path: 'inbox', icon: Inbox, comingSoon: true },
      { key: 'customers', path: 'customers', icon: Users, comingSoon: true },
      { key: 'orders', path: 'orders', icon: ShoppingBag, comingSoon: true },
      { key: 'reservations', path: 'reservations', icon: CalendarCheck, comingSoon: true },
    ],
  },
  {
    key: 'assistant',
    items: [
      { key: 'knowledge', path: 'knowledge', icon: BookOpen, comingSoon: true },
      { key: 'bots', path: 'assistants', icon: Bot, comingSoon: true },
      { key: 'playground', path: 'playground', icon: FlaskConical, comingSoon: true },
    ],
  },
  {
    key: 'grow',
    items: [
      { key: 'connect', path: 'connect', icon: Plug, comingSoon: true },
      { key: 'analytics', path: 'analytics', icon: ChartColumn, comingSoon: true },
    ],
  },
  {
    key: 'manage',
    items: [
      { key: 'billing', path: 'billing', icon: CreditCard, comingSoon: true },
      { key: 'settings', path: 'settings', icon: Settings, comingSoon: false },
    ],
  },
];

export const ADMIN_ITEM: NavItem = { key: 'admin', path: 'admin', icon: Shield, comingSoon: true };

export const ALL_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

export function sectionHref(slug: string, item: NavItem): string {
  if (item.key === 'admin') return '/admin';
  return item.path ? `/w/${slug}/${item.path}` : `/w/${slug}`;
}
