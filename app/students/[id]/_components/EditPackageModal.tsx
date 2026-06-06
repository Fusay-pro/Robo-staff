'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  target:    any | null;
  studentId: string;
  onClose:   () => void;
}

export default function EditPackageModal({ target, studentId, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState({ custom_name: '', custom_class_count: '' });
  const [err, setErr]   = useState('');

  useEffect(() => {
    if (target) {
      setForm({
        custom_name:        target.custom_name ?? '',
        custom_class_count: target.custom_class_count != null ? String(target.custom_class_count) : '',
      });
      setErr('');
    }
  }, [target]);

  const mut = useMutation({
    mutationFn: ({ cpId, body }: { cpId: number; body: any }) =>
      client.patch(`/customer-packages/${cpId}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-packages', studentId] });
      qc.invalidateQueries({ queryKey: ['student', studentId] });
      onClose();
    },
    onError: (e: any) => setErr(e?.response?.data?.error || t('students.failedEditPkg')),
  });

  function save() {
    if (!target) return;
    setErr('');
    const body: any = {};
    body.custom_name        = form.custom_name.trim() || null;
    body.custom_class_count = form.custom_class_count ? parseInt(form.custom_class_count) : null;
    mut.mutate({ cpId: target.customer_package_id, body });
  }

  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-on-surface">{t('students.editPkg')}</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant mb-5">{t('students.editPkgHint')}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('manage.pkg.name')}</label>
            <input value={form.custom_name} onChange={e => setForm(f => ({ ...f, custom_name: e.target.value }))}
              placeholder={target.base_package_name ?? target.package_name}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('manage.pkg.classCount')}</label>
            <input type="number" min="1" value={form.custom_class_count}
              onChange={e => setForm(f => ({ ...f, custom_class_count: e.target.value }))}
              placeholder={String(target.class_count)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={save} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('common.saving') : t('students.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
