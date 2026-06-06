'use client';
import { useState } from 'react';
import { useT } from '@/context/I18nContext';

export default function AttendancePopup({
  row,
  onClose,
  onMark,
  isPending,
}: {
  row: any;
  onClose: () => void;
  onMark: (status: 'present' | 'absent', notes: string) => void;
  isPending: boolean;
}) {
  const { t } = useT();
  const [notes, setNotes] = useState('');
  const isPresent = row.attendance_status === 'present';
  const isAbsent  = row.attendance_status === 'absent';
  const canMark   = notes.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-outline-variant/30 z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white font-bold text-base shrink-0">
              {row.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-on-surface text-base leading-tight truncate">{row.name}</p>
              {row.package_name && (
                <p className="text-xs text-on-surface-variant mt-0.5">{row.package_name}</p>
              )}
              {row.pre_existing_conditions && (
                <p className="text-xs text-error font-semibold mt-0.5">{t('today.medicalOnFile')}</p>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {row.attendance_status && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
              isPresent ? 'bg-success-container text-on-success-container'
              : isAbsent ? 'bg-error-container text-error'
              : 'bg-surface-container text-on-surface-variant'
            }`}>
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPresent ? 'check_circle' : isAbsent ? 'cancel' : 'help'}
              </span>
              {t('today.currently')} {isPresent ? t('today.present') : isAbsent ? t('today.skipped') : t('today.notMarked')}
              {row.attendance_notes && (
                <span className="ml-1 text-[11px] italic truncate opacity-70">— {row.attendance_notes}</span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              {t('today.sessionNote')} <span className="text-error">*</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('today.sessionNotePlace')}
              rows={3}
              className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            {!canMark && (
              <p className="text-[11px] text-on-surface-variant mt-1">{t('today.addNoteHint')}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onMark('present', notes.trim())}
              disabled={!canMark || isPending}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl font-bold text-sm transition-all border-2 ${
                !canMark || isPending
                  ? 'opacity-40 cursor-not-allowed bg-white border-outline-variant/30 text-on-surface-variant'
                  : isPresent
                  ? 'bg-success-container border-success text-on-success-container'
                  : 'bg-white border-outline-variant/40 text-on-surface hover:border-success hover:bg-success-container/30'
              }`}
            >
              <span className="material-symbols-outlined text-[28px] text-success" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              {t('today.present')}
            </button>

            <button
              onClick={() => onMark('absent', notes.trim())}
              disabled={!canMark || isPending}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl font-bold text-sm transition-all border-2 ${
                !canMark || isPending
                  ? 'opacity-40 cursor-not-allowed bg-white border-outline-variant/30 text-on-surface-variant'
                  : isAbsent
                  ? 'bg-error-container border-error text-error'
                  : 'bg-white border-outline-variant/40 text-on-surface hover:border-error hover:bg-error-container/30'
              }`}
            >
              <span className="material-symbols-outlined text-[28px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>
                cancel
              </span>
              {t('today.skipped')}
            </button>
          </div>
        </div>

        {isPending && (
          <div className="px-6 pb-4 flex items-center gap-2 text-xs text-on-surface-variant">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {t('today.savingShort')}
          </div>
        )}
      </div>
    </div>
  );
}
