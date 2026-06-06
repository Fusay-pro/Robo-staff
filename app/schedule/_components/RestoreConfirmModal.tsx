'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';

interface Props {
  target:  any | null;
  onClose: () => void;
}

export default function RestoreConfirmModal({ target, onClose }: Props) {
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (id: number) => client.post(`/holidays/${id}/restore`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-month'] });
      qc.invalidateQueries({ queryKey: ['holidays'] });
      onClose();
    },
  });

  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-emerald-600 text-2xl">restore</span>
        </div>
        <h3 className="text-lg font-bold text-on-surface mb-1">Restore Sessions?</h3>
        <p className="text-sm text-on-surface-variant mb-2">
          <span className="font-semibold text-on-surface">{target.name}</span>
        </p>
        <p className="text-sm text-on-surface-variant mb-6">
          {target.cancelled_count} cancelled session{target.cancelled_count !== 1 ? 's' : ''} will be restored and the holiday removed.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button onClick={() => mut.mutate(target.holiday_id)} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  );
}
