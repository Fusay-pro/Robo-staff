'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/context/I18nContext';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}
function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

interface Props {
  dropRef:      React.RefObject<HTMLDivElement | null>;
  dropPos:      { top: number; right: number; isMobile: boolean };
  next:         any | null;
  lowKids:      any[];
  pendingCount: number;
  showPending:  boolean;
  cancelCount:  number;
  showCancel:   boolean;
  totalCount:   number;
  dismiss:      (key: string) => void;
  markAllAsRead: () => void;
  onClose:      () => void;
}

export default function StaffAlertDropdown({
  dropRef, dropPos, next, lowKids,
  pendingCount, showPending, cancelCount, showCancel,
  totalCount, dismiss, markAllAsRead, onClose,
}: Props) {
  const { t } = useT();
  const router = useRouter();

  return (
    <div
      ref={dropRef}
      style={
        dropPos.isMobile
          ? { position: 'fixed', top: dropPos.top, left: 0, right: 0, zIndex: 9999 }
          : { position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9999 }
      }
      className={`${dropPos.isMobile
        ? 'w-auto max-w-none rounded-3xl mx-3 border-outline-variant/40'
        : 'w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl'
      } bg-surface shadow-2xl border overflow-hidden`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between">
        <h3 className="font-bold text-on-surface text-base">{t('bell.notifications')}</h3>
        {dropPos.isMobile ? (
          <button onClick={markAllAsRead} disabled={totalCount === 0}
            className="text-xs font-bold text-primary disabled:text-on-surface-variant disabled:opacity-60">
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
              onClick={() => { onClose(); router.push(`/schedules/${next.schedule_id}`); }}>
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
                  onClick={() => { onClose(); router.push(`/schedules/${k.schedule_id}`); }}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.classes_remaining === 0 ? 'bg-error/10' : 'bg-orange-100'}`}>
                    <span className={`material-symbols-outlined text-[18px] ${k.classes_remaining === 0 ? 'text-error' : 'text-orange-600'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-on-surface text-sm truncate">{k.student_name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">{k.session_name} · {fmtTime(k.starts_at)}</p>
                    <p className={`text-[11px] font-bold mt-0.5 ${k.classes_remaining === 0 ? 'text-error' : 'text-orange-700'}`}>
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

        {/* Pending approvals (owner only) */}
        {showPending && (
          <div className="group flex gap-3 px-5 py-3.5 hover:bg-surface-container-low transition-colors border-b border-outline-variant/15">
            <button className="flex gap-3 flex-1 min-w-0 text-left"
              onClick={() => { onClose(); router.push('/approvals'); }}>
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

        {/* Pending cancellation requests (owner only) */}
        {showCancel && (
          <div className="group flex gap-3 px-5 py-3.5 hover:bg-surface-container-low transition-colors">
            <button className="flex gap-3 flex-1 min-w-0 text-left"
              onClick={() => { onClose(); router.push('/approvals'); }}>
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
          <button className="text-sm font-bold text-primary"
            onClick={() => { onClose(); router.push('/today'); }}>
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
