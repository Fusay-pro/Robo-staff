'use client';

import AppShell from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import client from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function ApprovalsPage() {
  const [tab, setTab] = useState<'pending' | 'cancellations' | 'reviewed'>('pending');
  const qc = useQueryClient();
  const { role } = useAuth();
  const { t } = useT();
  const isOwner = role === 'owner' || role === 'super_owner';

  const { data: pendingData, isLoading: loadPending } = useQuery<any>({
    queryKey: ['approvals', 'pending'],
    queryFn: () => client.get('/students?approval_status=pending&limit=50').then(r => r.data),
  });
  const { data: reviewedData, isLoading: loadReviewed } = useQuery<any>({
    queryKey: ['approvals', 'reviewed'],
    queryFn: () => client.get('/students?approval_status=approved,rejected&limit=50').then(r => r.data),
    enabled: tab === 'reviewed',
  });
  const { data: cancelData = [], isLoading: loadCancel } = useQuery<any[]>({
    queryKey: ['parent-requests', 'pending'],
    queryFn: () => client.get('/requests?status=pending').then(r => r.data),
    refetchInterval: 60_000,
  });

  const pendingList: any[]  = pendingData?.data  ?? pendingData  ?? [];
  const reviewedList: any[] = reviewedData?.data ?? reviewedData ?? [];
  const list    = tab === 'pending' ? pendingList : tab === 'reviewed' ? reviewedList : [];
  const loading = tab === 'pending' ? loadPending : tab === 'reviewed' ? loadReviewed : loadCancel;

  const approve = useMutation({
    mutationFn: (id: number) => client.patch(`/students/${id}`, { approval_status: 'approved' }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['approvals'] }); },
  });
  const reject = useMutation({
    mutationFn: (id: number) => client.patch(`/students/${id}`, { approval_status: 'rejected' }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['approvals'] }); },
  });

  const cancelDecide = useMutation({
    mutationFn: (p: { id: number; action: 'approve' | 'reject'; note?: string }) =>
      client.patch(`/requests/${p.id}`, { action: p.action, note: p.note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-requests'] });
      qc.invalidateQueries({ queryKey: ['alerts-feed'] });
    },
  });

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-on-surface">{t('nav.approvals')}</h2>
          <p className="text-on-surface-variant mt-1 text-sm">{t('approvals.subtitle2')}</p>
        </div>

        {/* Underline tabs */}
        <div className="flex gap-6 border-b border-outline-variant/20 mb-6 overflow-x-auto">
          {(['pending', 'cancellations', 'reviewed'] as const).map(k => {
            const count = k === 'pending' ? pendingList.length
                       : k === 'cancellations' ? cancelData.length
                       : 0;
            const label = k === 'pending' ? t('approvals.tabs.newStudents')
                       : k === 'cancellations' ? t('approvals.tabs.parentRequests')
                       : t('approvals.tabs.reviewed');
            return (
              <button key={k} onClick={() => setTab(k)}
                className={`pb-3 text-sm font-bold transition-colors relative whitespace-nowrap ${tab === k ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                {label}
                {count > 0 && (
                  <span className={`ml-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full align-middle ${k === 'cancellations' ? 'bg-orange-500' : 'bg-primary'}`}>
                    {count}
                  </span>
                )}
                {tab === k && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            );
          })}
        </div>

        {tab === 'cancellations' ? (
          loadCancel ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-44 bg-surface-container-low animate-pulse rounded-3xl" />)}
            </div>
          ) : cancelData.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-outline block mb-3">event_available</span>
              <p className="font-semibold text-on-surface-variant">{t('approvals.noParentRequests')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cancelData.map((r: any) => {
                const d  = r.details || {};
                const sd = d.starts_at ? new Date(d.starts_at) : null;
                const TYPE_META: Record<string, { label: string; icon: string; bg: string; iconBg: string; text: string; btn: string }> = {
                  cancellation:   { label: t('approvals.cancellationRequest'), icon: 'event_busy',   bg: 'bg-orange-50', iconBg: 'bg-orange-100', text: 'text-orange-700', btn: 'bg-orange-500' },
                  absence:        { label: t('approvals.absenceNotice'),       icon: 'sick',         bg: 'bg-amber-50',  iconBg: 'bg-amber-100',  text: 'text-amber-700',  btn: 'bg-amber-500' },
                  refund:         { label: t('approvals.refundRequest'),       icon: 'request_quote',bg: 'bg-rose-50',   iconBg: 'bg-rose-100',   text: 'text-rose-700',   btn: 'bg-rose-500' },
                  reinstatement:  { label: t('approvals.reinstatement'),       icon: 'restart_alt',  bg: 'bg-blue-50',   iconBg: 'bg-blue-100',   text: 'text-blue-700',   btn: 'bg-blue-500' },
                };
                const meta = TYPE_META[r.type] || TYPE_META.cancellation;
                return (
                  <div key={r.request_id}
                    className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/30">
                    <div className={`px-5 py-4 border-b border-outline-variant/20 ${meta.bg} flex items-center gap-3`}>
                      <div className={`w-9 h-9 rounded-xl ${meta.iconBg} flex items-center justify-center shrink-0`}>
                        <span className={`material-symbols-outlined ${meta.text} text-[18px]`} style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</p>
                        <p className="text-xs text-on-surface-variant">
                          {(() => {
                            const dt = new Date(r.created_at);
                            return `${dt.getDate()} ${t(`date.monthsShort.${dt.getMonth() + 1}`)} · ${dt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`;
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t('approvals.studentLabel')}</p>
                        <p className="font-bold text-on-surface">{d.kid_name || '—'}</p>
                      </div>
                      {(d.course_name || sd) && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t('approvals.classLabel')}</p>
                          <p className="font-semibold text-on-surface text-sm">{d.course_name || t('dashboard.session')}</p>
                          {sd && (
                            <p className="text-xs text-on-surface-variant">
                              {t(`date.daysShort.${DAY_KEYS[sd.getDay()]}`)} {sd.getDate()} {t(`date.monthsShort.${sd.getMonth() + 1}`)} · {sd.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t('approvals.reasonFrom')} {r.parent_name || t('approvals.parentLower')}</p>
                        <p className="text-sm text-on-surface whitespace-pre-wrap mt-1 bg-surface-container-low rounded-xl px-3 py-2">{d.reason || '—'}</p>
                      </div>

                      {isOwner ? (
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => cancelDecide.mutate({ id: r.request_id, action: 'approve' })}
                            disabled={cancelDecide.isPending}
                            className={`flex-1 ${meta.btn} text-white py-2.5 rounded-2xl text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50`}>
                            {t('approvals.approve')}
                          </button>
                          <button onClick={() => cancelDecide.mutate({ id: r.request_id, action: 'reject' })}
                            disabled={cancelDecide.isPending}
                            className="px-5 border-2 border-outline-variant text-on-surface-variant rounded-2xl text-sm font-bold hover:bg-surface-container active:scale-95 transition-all disabled:opacity-50">
                            {t('approvals.reject')}
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-on-surface-variant italic">{t('approvals.ownerRequired')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-52 bg-surface-container-low animate-pulse rounded-3xl" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-outline block mb-3">how_to_reg</span>
            <p className="font-semibold text-on-surface-variant">
              {tab === 'pending' ? t('approvals.noPendingFull') : t('approvals.noReviewed')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((s: any) => {
              const isPending  = s.approval_status === 'pending';
              const isApproved = s.approval_status === 'approved';
              const initials   = s.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';

              return (
                <div key={s.student_id}
                  className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/30 hover:-translate-y-0.5 transition-all">

                  {/* Card header */}
                  <div className="flex items-start gap-4 p-5 pb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/students/${s.student_id}`}
                          className="font-bold text-on-surface hover:text-primary transition-colors text-base leading-tight">
                          {s.name}
                        </Link>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wide shrink-0">
                          {(() => {
                            const dt = new Date(s.created_at);
                            return `${dt.getDate()} ${t(`date.monthsShort.${dt.getMonth() + 1}`)} ${dt.getFullYear()}`;
                          })()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {s.age && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                            {t('approvals.ageLabel')} {s.age}
                          </span>
                        )}
                        {!isPending && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-error/10 text-error'}`}>
                            {isApproved ? t('students.status.approved') : t('students.status.rejected')}
                          </span>
                        )}
                        {s.branch_name && (
                          <span className="text-[10px] font-semibold text-primary">{s.branch_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 px-5 pb-4">
                    <div className="bg-surface-container-low rounded-2xl px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">{t('students.parent')}</p>
                      <p className="text-sm font-semibold text-on-surface truncate">{s.parent_name || '—'}</p>
                      {s.parent_phone && <p className="text-xs text-on-surface-variant">{s.parent_phone}</p>}
                    </div>
                    <div className={`rounded-2xl px-3 py-2.5 ${s.pre_existing_conditions ? 'bg-error/5 border border-error/20' : 'bg-surface-container-low'}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">{t('approvals.medicalNotes')}</p>
                      {s.pre_existing_conditions
                        ? <p className="text-xs text-error font-medium line-clamp-2">{s.pre_existing_conditions}</p>
                        : <p className="text-sm text-on-surface-variant">{t('approvals.noneMedical')}</p>
                      }
                    </div>
                  </div>

                  {/* Actions (pending only) */}
                  {isPending && (
                    <div className="flex gap-2 px-5 pb-5">
                      <button
                        onClick={() => approve.mutate(s.student_id)}
                        disabled={approve.isPending || reject.isPending}
                        className="flex-1 bg-primary text-white py-2.5 rounded-2xl text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
                        {t('approvals.approve')}
                      </button>
                      <button
                        onClick={() => reject.mutate(s.student_id)}
                        disabled={approve.isPending || reject.isPending}
                        className="px-6 border-2 border-error/30 text-error rounded-2xl text-sm font-bold hover:bg-error/5 active:scale-95 transition-all disabled:opacity-50">
                        {t('approvals.reject')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
