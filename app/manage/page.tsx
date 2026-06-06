'use client';
import AppShell from '@/components/AppShell';
import { useState } from 'react';
import { useT } from '@/context/I18nContext';
import CoursesTab from './_components/CoursesTab';
import EnrollTab from './_components/EnrollTab';
import AnnouncementsTab from './_components/AnnouncementsTab';
import StaffTab from './_components/StaffTab';
import SettingsTab from './_components/SettingsTab';

type TabKey = 'courses' | 'enroll' | 'staff' | 'announcements' | 'settings';

export default function ManagePage() {
  const { t } = useT();
  const [tab, setTab] = useState<TabKey>('courses');

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'courses',       label: t('manage.tab.courses'),       icon: 'school' },
    { key: 'enroll',        label: t('manage.tab.enroll'),        icon: 'person_add' },
    { key: 'staff',         label: t('manage.tab.staff'),         icon: 'badge' },
    { key: 'announcements', label: t('manage.tab.announcements'), icon: 'campaign' },
    { key: 'settings',      label: t('manage.tab.settings'),      icon: 'tune' },
  ];

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-on-surface">{t('manage.title')}</h2>
          <p className="text-on-surface-variant mt-1 text-sm">{t('manage.subtitle2')}</p>
        </div>

        <div className="flex gap-1 mb-6 bg-surface-container rounded-2xl p-1">
          {TABS.map(tab2 => (
            <button key={tab2.key} onClick={() => setTab(tab2.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-bold rounded-xl transition-all ${tab === tab2.key ? 'bg-background text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-[18px]" style={tab === tab2.key ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab2.icon}</span>
              <span className="hidden sm:inline">{tab2.label}</span>
            </button>
          ))}
        </div>

        {tab === 'courses'       && <CoursesTab />}
        {tab === 'enroll'        && <EnrollTab />}
        {tab === 'staff'         && <StaffTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'settings'      && <SettingsTab />}
      </div>
    </AppShell>
  );
}
