'use client';

import AppShell from '@/components/AppShell';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';
import SessionCard from './_components/SessionCard';
import StatCard from './_components/StatCard';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function offsetDate(base: Date, days: number) {
  const d = new Date(base); d.setDate(d.getDate() + days); return d;
}

export default function TodayPage() {
  const { t } = useT();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [date, setDate] = useState(today);

  const dateStr = toDateString(date);
  const todayStr = toDateString(today);
  const tomorrowStr = toDateString(offsetDate(today, 1));

  type Tab = 'today' | 'tomorrow' | 'other';
  const activeTab: Tab =
    dateStr === todayStr    ? 'today' :
    dateStr === tomorrowStr ? 'tomorrow' : 'other';

  const setTab = (tab: Tab) => {
    if (tab === 'today') setDate(new Date(today));
    else if (tab === 'tomorrow') setDate(offsetDate(today, 1));
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'today',    label: t('today.tabToday') },
    { key: 'tomorrow', label: t('today.tabTomorrow') },
  ];

  const longDate = (() => {
    const wd = DAY_KEYS[date.getDay()];
    return `${t(`date.daysLong.${wd}`)}, ${date.getDate()} ${t(`date.months.${date.getMonth() + 1}`)} ${date.getFullYear()}`;
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['schedules-day', dateStr],
    queryFn: () => client.get(`/schedules?date=${dateStr}&limit=50&offset=0`).then(r => r.data?.data ?? []),
  });

  const sessions: any[] = data ?? [];
  const totalStudents = sessions.reduce((sum, s) => sum + (s.enrolled_count ?? 0), 0);
  const schoolSessions = sessions.filter(s => s.schedule_type === 'contract_school' || !!s.contract_school_name).length;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 md:px-8 w-full pb-24 md:pb-8">

        <div className="sticky top-0 z-30 bg-surface-container-low/95 backdrop-blur-md py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-[20px] text-on-surface leading-tight">
                {activeTab === 'today'    ? t('today.yourSessions') :
                 activeTab === 'tomorrow' ? t('today.tomorrowSessions') :
                 longDate}
              </p>
              <p className="text-[12px] text-on-surface-variant mt-0.5">{longDate}</p>
            </div>
          </div>

          <div className="flex gap-2 bg-surface-container-lowest rounded-2xl p-1.5 shadow-sm border border-outline-variant/30">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!isLoading && sessions.length > 0 && (
          <div className="flex gap-3 mt-1 mb-4">
            <StatCard icon="event_note" label={t('today.statSessions')}       value={sessions.length} color="bg-primary" />
            <StatCard icon="group"      label={t('today.statTotalStudents')} value={totalStudents}   color="bg-[#10b981]" />
            {schoolSessions > 0 && (
              <StatCard icon="school"   label={t('today.statSchoolVisits')}  value={schoolSessions}  color="bg-[#0ea5e9]" />
            )}
          </div>
        )}

        <div className="pb-8 space-y-3">
          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="h-20 bg-surface-container-lowest animate-pulse rounded-xl border border-outline-variant/20" />)
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant/30">
              <span className="material-symbols-outlined text-5xl text-outline block mb-3">event_busy</span>
              <p className="font-bold text-on-surface mb-1">{t('today.noScheduled')}</p>
              <p className="text-sm text-on-surface-variant">
                {activeTab === 'today' ? t('today.enjoyQuiet') : t('today.nothingThisDay')}
              </p>
            </div>
          ) : (
            sessions.map((s: any) => (
              <SessionCard key={s.schedule_id} s={s} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
