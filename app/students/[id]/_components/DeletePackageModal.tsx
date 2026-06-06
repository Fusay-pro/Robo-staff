'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  target:    any | null;
  studentId: string;
  onClose:   () => void;
}

export default function DeletePackageModal({ target, studentId, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (cpId: number) => client.patch(`/customer-packages/${cpId}`, { is_active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-packages', studentId] });
      qc.invalidateQueries({ queryKey: ['student', studentId] });
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
        <h3 className="text-lg font-bold text-on-surface mb-1">{t('students.removePackageQ')}</h3>
        <p className="text-sm text-on-surface-variant mb-1">
          <span className="font-semibold text-on-surface">{target.package_name}</span>
        </p>
        <p className="text-xs text-on-surface-variant mb-6">
          {t('students.classesStillLeft', { n: target.classes_remaining })}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={() => mut.mutate(target.customer_package_id)} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('students.removing') : t('students.remove')}
          </button>
        </div>
      </div>
    </div>
  );
}
