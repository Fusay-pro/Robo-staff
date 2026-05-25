'use client';

import AppShell from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import client from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const today = toDateString(new Date());
  const qc = useQueryClient();
  const { role } = useAuth();
  const { t } = useT();
  const isOwner = role === 'owner' || role === 'super_owner';

  const [editSession, setEditSession] = useState<any>(null);
  const [form, setForm] = useState({ date: '', start_time: '', end_time: '', max_capacity: '' });
  const [formError, setFormError] = useState('');

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ['schedules-day', today],
    queryFn: () => client.get(`/schedules?date=${today}&limit=50`).then(r => r.data?.data ?? []),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['owner-stats'],
    queryFn: () => client.get('/owner/stats').then(r => r.data).catch(() => null),
  });

  const { data: pendingRaw } = useQuery<any>({
    queryKey: ['approvals', 'pending'],
    queryFn: () => client.get('/students?approval_status=pending&limit=5').then(r => r.data),
  });
  const pending: any[] = Array.isArray(pendingRaw) ? pendingRaw : (pendingRaw?.data ?? []);

  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      client.patch(`/schedules/${id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-day'] });
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      setEditSession(null);
    },
    onError: (e: any) => setFormError(e.response?.data?.error || t('dashboard.failedUpdate')),
  });

  function openEdit(s: any, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const start = new Date(s.starts_at);
    const end   = new Date(s.ends_at);
    setForm({
      date: toDateString(start),
      start_time: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
      end_time:   `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`,
      max_capacity: String(s.max_capacity || ''),
    });
    setFormError('');
    setEditSession(s);
  }

  function handleSave() {
    setFormError('');
    editMut.mutate({
      id: editSession.schedule_id,
      body: {
        starts_at: `${form.date}T${form.start_time}:00`,
        ends_at:   `${form.date}T${form.end_time}:00`,
        max_capacity: form.max_capacity ? parseInt(form.max_capacity) : undefined,
      },
    });
  }

  const statCards = [
    { label: t('dashboard.totalStudents'), value: stats?.total_students ?? '—', icon: 'group', color: 'bg-primary/10 text-primary' },
    { label: t('dashboard.sessionsToday'), value: schedules.length, icon: 'calendar_today', color: 'bg-secondary/10 text-secondary' },
    { label: t('dashboard.revenueThisMonth'), value: stats?.revenue_this_month ? `฿${Number(stats.revenue_this_month).toLocaleString()}` : '—', icon: 'payments', color: 'bg-tertiary/10 text-tertiary' },
    { label: t('dashboard.pendingApprovals'), value: pending.length, icon: 'fact_check', color: 'bg-error/10 text-error' },
  ];

  const now = new Date();
  const dateLabel = `${t(`date.daysLong.${DAY_KEYS[now.getDay()]}`)}, ${now.getDate()} ${t(`date.months.${now.getMonth() + 1}`)}`;

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-on-surface">{t('dashboard.title')}</h2>
          <p className="text-on-surface-variant mt-1">{dateLabel}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCards.map(s => (
            <div key={s.label} className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30">
              <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
                <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
              </div>
              <p className="text-2xl font-extrabold text-on-surface">{s.value}</p>
              <p className="text-xs text-on-surface-variant mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Today's Sessions */}
          <div className="lg:col-span-3 bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-bold text-on-surface text-lg">{t('dashboard.todaySessions')}</h3>
              <Link href="/today" className="text-xs text-primary font-bold hover:underline">{t('common.viewAll')}</Link>
            </div>

            {schedules.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-2">event_busy</span>
                <p className="text-sm">{t('today.noSessions')}</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {schedules.slice(0, 5).map((s: any) => {
                  const fill = s.max_capacity > 0 ? s.enrolled_count / s.max_capacity : 0;
                  const isFull = fill >= 1;
                  const isSchool = !!s.contract_school_id;
                  return (
                    <Link key={s.schedule_id} href={`/schedules/${s.schedule_id}`}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low hover:bg-surface-container hover:-translate-y-0.5 transition-all group cursor-pointer">
                      {/* Time block */}
                      <div className="shrink-0 w-16 text-center">
                        <p className="text-[11px] font-bold text-primary leading-tight">{fmtTime(s.starts_at)}</p>
                        <div className="w-px h-3 bg-outline-variant/50 mx-auto my-0.5" />
                        <p className="text-[11px] text-on-surface-variant leading-tight">{fmtTime(s.ends_at)}</p>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-10 bg-outline-variant/30 shrink-0" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">
                          {s.course_name || s.contract_school_name || t('dashboard.session')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {s.robot_type_name && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {s.robot_type_name}
                            </span>
                          )}
                          {isSchool && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary uppercase tracking-wide">
                              {t('dashboard.school')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Capacity */}
                      {s.max_capacity > 0 && (
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-bold ${isFull ? 'text-error' : 'text-on-surface'}`}>
                            {s.enrolled_count}/{s.max_capacity}
                          </p>
                          <div className="w-16 h-1.5 bg-surface-container rounded-full mt-1 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isFull ? 'bg-error' : 'bg-primary'}`}
                              style={{ width: `${Math.min(fill * 100, 100)}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Owner edit */}
                      {isOwner && (
                        <button onClick={e => openEdit(s, e)}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/10 text-primary transition-all">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Approvals */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-bold text-on-surface text-lg">{t('dashboard.pendingApprovals')}</h3>
              <Link href="/approvals" className="text-xs text-primary font-bold hover:underline">{t('dashboard.review')}</Link>
            </div>
            {pending.length === 0 ? (
              <div className="py-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl block mb-2">check_circle</span>
                <p className="text-sm">{t('dashboard.allCaughtUp')}</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {pending.map((s: any) => (
                  <Link key={s.student_id} href={`/students/${s.student_id}`}
                    className="flex items-center gap-3 p-3.5 rounded-2xl hover:bg-surface-container-low transition-colors group">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {s.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface text-sm truncate group-hover:text-primary transition-colors">{s.name}</p>
                      <p className="text-xs text-on-surface-variant">{s.branch_name || '—'}</p>
                    </div>
                    <span className="text-[10px] bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide shrink-0">
                      {t('students.status.pending')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditSession(null)} />
          <div className="relative bg-background rounded-3xl p-6 w-full max-w-md shadow-2xl z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-on-surface">{t('dashboard.editSession')}</h3>
              <button onClick={() => setEditSession(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <p className="text-sm text-on-surface-variant mb-5">
              {editSession.course_name || editSession.contract_school_name || t('dashboard.session')}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('dashboard.date')}</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('dashboard.start')}</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('dashboard.end')}</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('dashboard.maxCapacity')}</label>
                <input type="number" min="1" value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {formError && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditSession(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleSave} disabled={editMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {editMut.isPending ? t('common.saving') : t('dashboard.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
