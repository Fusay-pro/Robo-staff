'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { role, name, signOut } = useAuth();
  const { t } = useT();
  const isOwner = role === 'owner' || role === 'super_owner';

  const STAFF_NAV = [
    { href: '/today',    icon: 'calendar_today', label: t('nav.today') },
    { href: '/schedule', icon: 'calendar_month', label: t('nav.schedule') },
    { href: '/students', icon: 'group',          label: t('nav.students') },
  ];

  const OWNER_NAV = [
    { href: '/dashboard', icon: 'dashboard',      label: t('nav.dashboard') },
    { href: '/schedule',  icon: 'calendar_month', label: t('nav.schedule') },
    { href: '/students',  icon: 'group',          label: t('nav.students') },
    { href: '/activity',  icon: 'monitoring',     label: t('nav.activity') },
    { href: '/approvals', icon: 'fact_check',     label: t('nav.approvals') },
    { href: '/manage',    icon: 'tune',           label: t('nav.manage') },
  ];

  const NAV = isOwner ? OWNER_NAV : STAFF_NAV;

  return (
    <aside className="fixed left-0 top-0 h-full w-[280px] hidden md:flex flex-col z-50 py-8 bg-surface border-r border-outline-variant/40">
      {/* Logo */}
      <div className="px-6 mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>precision_manufacturing</span>
          </div>
          <span className="text-xl font-bold text-primary">{t('nav.roboticsPortal')}</span>
        </div>
        <p className="text-[11px] text-on-surface-variant opacity-70 px-1 tracking-widest uppercase">{isOwner ? t('nav.ownerAccess') : t('nav.staffAccess')}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 py-3 px-4 transition-all text-sm font-semibold ${
                active
                  ? 'bg-secondary-fixed text-on-secondary-fixed border-l-4 border-primary rounded-r-xl'
                  : 'text-on-surface-variant hover:bg-surface-container-high rounded-xl'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-4 mt-auto">
        <div className="p-3 bg-surface-container rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-on-surface truncate">{name || (isOwner ? t('nav.owner') : t('nav.staff'))}</p>
            <p className="text-[10px] text-on-surface-variant truncate">{isOwner ? t('nav.owner') : t('nav.staff')}</p>
          </div>
          <button
            onClick={signOut}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors"
            title={t('nav.signOut')}
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
