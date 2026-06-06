'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  target:  any | null;
  onClose: () => void;
}

export default function DeleteConfirmModal({ target, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (id: number) => client.delete(`/schedules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-month'] });
      onClose();
    },
  });

  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
        <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-error text-2xl">delete</span>
        </div>
        <h3 className="text-lg font-bold text-on-surface mb-1">{t('schedule.deleteSessionQ')}</h3>
        <p className="text-sm text-on-surface-variant mb-6">
          {t('schedule.deleteSessionMsg', {
            name: target.course_name || t('schedule.thisSession'),
            date: (() => { const dt = new Date(target.starts_at); return `${dt.getDate()} ${t(`date.monthsShort.${dt.getMonth() + 1}`)}`; })(),
          })}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={() => mut.mutate(target.schedule_id)} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('schedule.deleting') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
