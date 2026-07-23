'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  studentId:   string;
  studentName: string;
  onClose:     () => void;
}

export default function DeleteStudentModal({ studentId, studentName, onClose }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr]           = useState('');

  const mut = useMutation({
    mutationFn: () => client.delete(`/students/${studentId}`, { data: { password } }).then(r => r.data),
    onSuccess: () => { router.push('/students'); },
    onError:   (e: any) => setErr(e?.response?.data?.error || t('students.deleteError')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-sm">
        <div className="px-6 pt-5 pb-3 border-b border-error/20">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-error text-[20px]">warning</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface">{t('students.deleteTitle')}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            {t('students.deleteWarning')} <span className="font-semibold text-on-surface">{studentName}</span>
          </p>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('sync.confirmPassword')}</label>
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 focus-within:border-error focus-within:ring-2 focus-within:ring-error/20 transition-all">
            <input type={showPass ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent py-2.5 text-sm text-on-surface outline-none" />
            <button type="button" onClick={() => setShowPass(v => !v)} className="text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mt-2">{err}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={() => mut.mutate()} disabled={!password || mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('students.deleting') : t('students.deleteLabel')}
          </button>
        </div>
      </div>
    </div>
  );
}
