export type StaffRole = 'staff' | 'owner';

export interface NavItemDef {
  href: '/today' | '/dashboard' | '/schedule' | '/students' | '/activity' | '/approvals' | '/manage';
  icon: string;
  labelKey: 'nav.today' | 'nav.dashboard' | 'nav.schedule' | 'nav.students' | 'nav.activity' | 'nav.approvals' | 'nav.manage';
}

export const STAFF_NAV_ITEMS: NavItemDef[] = [
  { href: '/today', icon: 'calendar_today', labelKey: 'nav.today' },
  { href: '/schedule', icon: 'calendar_month', labelKey: 'nav.schedule' },
  { href: '/students', icon: 'group', labelKey: 'nav.students' },
];

export const OWNER_NAV_ITEMS: NavItemDef[] = [
  { href: '/dashboard', icon: 'dashboard', labelKey: 'nav.dashboard' },
  { href: '/schedule', icon: 'calendar_month', labelKey: 'nav.schedule' },
  { href: '/students', icon: 'group', labelKey: 'nav.students' },
  { href: '/activity', icon: 'monitoring', labelKey: 'nav.activity' },
  { href: '/approvals', icon: 'fact_check', labelKey: 'nav.approvals' },
  { href: '/manage', icon: 'tune', labelKey: 'nav.manage' },
];

export function navItemsForRole(role: StaffRole): NavItemDef[] {
  return role === 'owner' ? OWNER_NAV_ITEMS : STAFF_NAV_ITEMS;
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
