'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { navItemsForRole, isActivePath } from '@/lib/nav';

export default function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const { t } = useT();
  const isOwner = role === 'owner' || role === 'super_owner';

  const NAV = navItemsForRole(isOwner ? 'owner' : 'staff');

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 md:hidden shadow-[0_-1px_8px_rgba(0,0,0,0.12)]" style={{ background: '#001e2f' }}>
      {NAV.map(({ href, icon, labelKey }) => {
        const active = isActivePath(pathname, href);
        const label = t(labelKey);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
              active ? 'bg-white/15 text-white' : 'text-white/50'
            }`}
          >
            <span className="material-symbols-outlined" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
            <span className="text-[10px] font-semibold mt-0.5">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
