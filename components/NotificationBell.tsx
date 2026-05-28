'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import client from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}
function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

// Dismissed notifications — keys map to expiry timestamp (24h TTL).
const DISMISS_KEY = 'staff_dismissed_alerts_v1';
const TTL_LIVE    = 24 * 60 * 60 * 1000;

function loadDismissed(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const live: Record<string, number> = {};
    for (const k in data) if (data[k] > now) live[k] = data[k];
    return live;
  } catch { return {}; }
}
function persistDismiss(key: string) {
  if (typeof window === 'undefined') return;
  const data = loadDismissed();
  data[key] = Date.now() + TTL_LIVE;
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

export default function NotificationBell() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [dismissedTick, setDismissedTick] = useState(0);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0, isMobile: false });
  const router = useRouter();
  const { role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_owner';
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const autoOpenedRef = useRef(false);

  function computeDropPos() {
    if (!btnRef.current || typeof window === 'undefined') return;
    const r = btnRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    setDropPos({
      top: r.bottom + 8,
      right: Math.max(8, window.innerWidth - r.right),
      isMobile,
    });
  }

  const { data } = useQuery<any>({
    queryKey: ['alerts-feed'],
    queryFn: () => client.get('/schedules/alerts').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      const insideBtn = btnRef.current?.contains(target);
      const insideDrop = dropRef.current?.contains(target);
      if (!insideBtn && !insideDrop) setOpen(false);
    }
    if (open) document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    computeDropPos();
    window.addEventListener('resize', computeDropPos);
    window.addEventListener('scroll', computeDropPos, true);
    return () => {
      window.removeEventListener('resize', computeDropPos);
      window.removeEventListener('scroll', computeDropPos, true);
    };
  }, [open]);

  const dismissed = useMemo(() => loadDismissed(), [dismissedTick]);
  const isDismissed = (key: string) => key in dismissed;
  function dismiss(key: string) {
    persistDismiss(key);
    setDismissedTick(t => t + 1);
  }

  const nextRaw      = data?.next_session;
  const next         = nextRaw && !isDismissed(`next-${nextRaw.schedule_id}`) ? nextRaw : null;
  const lowKidsRaw: any[] = data?.low_class_students ?? [];
  const lowKids      = lowKidsRaw.filter(k => !isDismissed(`lowkid-${k.student_id}-${k.schedule_id}`));
  const pendingCount: number = data?.pending_approvals ?? 0;
  const showPending  = isOwner && pendingCount > 0 && !isDismissed('pending-approvals');
  const cancelCount: number  = data?.pending_cancellations ?? 0;
  const showCancel   = isOwner && cancelCount > 0 && !isDismissed('pending-cancellations');

  const totalCount = (next ? 1 : 0) + lowKids.length + (showPending ? 1 : 0) + (showCancel ? 1 : 0);
  const markAllAsRead = () => {
    if (next) dismiss(`next-${next.schedule_id}`);
    lowKids.forEach((k: any) => dismiss(`lowkid-${k.student_id}-${k.schedule_id}`));
    if (showPending) dismiss('pending-approvals');
    if (showCancel) dismiss('pending-cancellations');
  };

  // Auto-open once per login/page load when alerts exist.
  useEffect(() => {
    if (typeof window === 'undefined' || autoOpenedRef.current || totalCount === 0) return;
    const t = setTimeout(() => {
      autoOpenedRef.current = true;
      computeDropPos();
      setOpen(true);
    }, 500);
    return () => clearTimeout(t);
  }, [totalCount]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          if (!open) computeDropPos();
          setOpen(v => !v);
        }}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors shrink-0"
      >
        <span className="material-symbols-outlined text-on-surface-variant text-[22px]" style={totalCount > 0 ? { fontVariationSettings: "'FILL' 1" } : {}}>
          notifications
        </span>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          style={
            dropPos.isMobile
              ? { position: 'fixed', top: dropPos.top, left: 0, right: 0, zIndex: 9999 }
              : { position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9999 }
          }
          className={`${dropPos.isMobile ? 'w-auto max-w-none rounded-3xl mx-3 border-outline-variant/40' : 'w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl'} bg-surface shadow-2xl border overflow-hidden`}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between">
            <h3 className="font-bold text-on-surface text-base">{t('bell.notifications')}</h3>
            {dropPos.isMobile ? (
              <button
                onClick={markAllAsRead}
                disabled={totalCount === 0}
                className="text-xs font-bold text-primary disabled:text-on-surface-variant disabled:opacity-60"
              >
                Mark all as read
              </button>
            ) : totalCount > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error/10 text-error">{totalCount}</span>
            ) : null}
          </div>

          <div className={`${dropPos.isMobile ? 'max-h-[calc(100dvh-11rem)] bg-slate-50' : 'max-h-[420px]'} overflow-y-auto`}>

            {/* Next session */}
            {next && (
              <div className="group flex gap-3 px-5 py-3.5 hover:bg-surface-container-low transition-colors border-b border-outline-variant/15">
                <button className="flex gap-3 flex-1 min-w-0 text-left"
                  onClick={() => { setOpen(false); router.push(`/schedules/${next.schedule_id}`); }}>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">{t('bell.upcomingSession')}</p>
                    <p className="font-bold text-on-surface text-sm truncate">
                      {next.course_name || next.contract_school_name || t('today.session')}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {(() => {
                        const m = minutesUntil(next.starts_at);
                        if (m <= 0) return t('bell.startingNow');
                        if (m < 60) return `${t('bell.in')} ${m} ${t('bell.min')} · ${fmtTime(next.starts_at)}`;
                        const h = Math.floor(m / 60);
                        return `${t('bell.in')} ${h}h ${m % 60}m · ${fmtTime(next.starts_at)}`;
                      })()}
                      {' · '}{next.enrolled_count} {next.enrolled_count !== 1 ? t('bell.studentsPlural') : t('bell.studentSingular')}
                    </p>
                  </div>
                </button>
                <button onClick={() => dismiss(`next-${next.schedule_id}`)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary opacity-50 group-hover:opacity-100 transition-all shrink-0 self-start"
                  title={t('bell.dismiss')}>
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            {/* Low class students */}
            {lowKids.length > 0 && (
              <>
                <div className={`${dropPos.isMobile ? 'hidden' : 'px-5 py-2 bg-orange-50 border-b border-orange-100'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    {t('bell.lowClassesToday')}
                  </p>
                </div>
                {lowKids.map((k: any) => (
                  <div key={`${k.student_id}-${k.schedule_id}`}
                    className="group flex gap-3 px-5 py-3 hover:bg-surface-container-low transition-colors border-b border-outline-variant/15">
                    <button className="flex gap-3 flex-1 min-w-0 text-left"
                      onClick={() => { setOpen(false); router.push(`/schedules/${k.schedule_id}`); }}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        k.classes_remaining === 0 ? 'bg-error/10' : 'bg-orange-100'
                      }`}>
                        <span className={`material-symbols-outlined text-[18px] ${
                          k.classes_remaining === 0 ? 'text-error' : 'text-orange-600'
                        }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          notifications_active
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface text-sm truncate">{k.student_name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                          {k.session_name} · {fmtTime(k.starts_at)}
                        </p>
                        <p className={`text-[11px] font-bold mt-0.5 ${
                          k.classes_remaining === 0 ? 'text-error' : 'text-orange-700'
                        }`}>
                          {k.classes_remaining === 0
                            ? t('bell.outOfClassesShort')
                            : t(k.classes_remaining !== 1 ? 'bell.onlyLeftClasses' : 'bell.onlyLeftClass', { n: k.classes_remaining })}
                        </p>
                      </div>
                    </button>
                    <button onClick={() => dismiss(`lowkid-${k.student_id}-${k.schedule_id}`)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-100 text-on-surface-variant hover:text-orange-700 opacity-50 group-hover:opacity-100 transition-all shrink-0 self-start"
                      title={t('bell.dismiss')}>
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Pending approvals (owner) */}
            {showPending && (
              <div className="group flex gap-3 px-5 py-3.5 hover:bg-surface-container-low transition-colors border-b border-outline-variant/15">
                <button className="flex gap-3 flex-1 min-w-0 text-left"
                  onClick={() => { setOpen(false); router.push('/approvals'); }}>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">{t('bell.pendingApprovalsShort')}</p>
                    <p className="font-bold text-on-surface text-sm">
                      {t(pendingCount !== 1 ? 'bell.studentsWaiting' : 'bell.studentWaiting', { n: pendingCount })}
                    </p>
                  </div>
                </button>
                <button onClick={() => dismiss('pending-approvals')}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-100 text-on-surface-variant hover:text-blue-600 opacity-50 group-hover:opacity-100 transition-all shrink-0 self-start"
                  title={t('bell.dismiss')}>
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            {/* Pending cancellation requests (owner) */}
            {showCancel && (
              <div className="group flex gap-3 px-5 py-3.5 hover:bg-surface-container-low transition-colors">
                <button className="flex gap-3 flex-1 min-w-0 text-left"
                  onClick={() => { setOpen(false); router.push('/approvals'); }}>
                  <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-orange-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-0.5">{t('bell.parentRequests')}</p>
                    <p className="font-bold text-on-surface text-sm">
                      {t(cancelCount !== 1 ? 'bell.parentsWaiting' : 'bell.parentWaiting', { n: cancelCount })}
                    </p>
                  </div>
                </button>
                <button onClick={() => dismiss('pending-cancellations')}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-100 text-on-surface-variant hover:text-orange-600 opacity-50 group-hover:opacity-100 transition-all shrink-0 self-start"
                  title={t('bell.dismiss')}>
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            {/* Empty */}
            {totalCount === 0 && (
              <div className="px-5 py-10 text-center">
                <span className="material-symbols-outlined text-5xl text-outline block mb-2">notifications_off</span>
                <p className="text-sm font-semibold text-on-surface-variant">{t('bell.allCaughtUp')}</p>
                <p className="text-xs text-on-surface-variant mt-1">{t('bell.noAlerts')}</p>
              </div>
            )}
          </div>
          {dropPos.isMobile && totalCount > 0 && (
            <div className="px-5 py-3 border-t border-outline-variant/20 text-center bg-white">
              <button
                className="text-sm font-bold text-primary"
                onClick={() => {
                  setOpen(false);
                  router.push('/today');
                }}
              >
                View all notifications
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
