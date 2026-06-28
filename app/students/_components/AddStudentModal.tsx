'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  open:    boolean;
  onClose: () => void;
}

function randomPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function AddStudentModal({ open, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    parent_name:  '',
    parent_email: '',
    parent_phone: '',
    parent_pass:  randomPassword(),
    name:         '',
    nickname:     '',
    date_of_birth: '',
    branch_id:    '',
    pre_existing_conditions: '',
  });
  const [err, setErr]       = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied]   = useState(false);

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn:  () => client.get('/branches').then(r => r.data?.data ?? r.data),
    enabled:  open,
  });

  const mut = useMutation({
    mutationFn: async (f: typeof form) => {
      // 1. Create parent account
      const { data: parent } = await client.post('/users', {
        name:     f.parent_name,
        email:    f.parent_email,
        phone:    f.parent_phone || undefined,
        password: f.parent_pass,
        role:     'parent',
      });
      // 2. Create student linked to parent
      const { data: student } = await client.post('/students', {
        name:                    f.name,
        nickname:                f.nickname || undefined,
        date_of_birth:           f.date_of_birth || undefined,
        branch_id:               parseInt(f.branch_id),
        pre_existing_conditions: f.pre_existing_conditions || undefined,
        parent_user_id:          parent.user_id,
      });
      // 3. Auto-approve
      await client.patch(`/confirmations/${student.student_id}`, { status: 'approved' });
      return student;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students-list'] });
      qc.invalidateQueries({ queryKey: ['students-stats'] });
      setSuccess(true);
    },
    onError: (e: any) => setErr(e?.response?.data?.error || t('students.failedCreate')),
  });

  function field(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }));
    setErr('');
  }

  function submit() {
    setErr('');
    if (!form.parent_name.trim()) { setErr('Parent name is required'); return; }
    if (!form.parent_email.trim()) { setErr('Parent email is required'); return; }
    if (!form.name.trim()) { setErr('Student name is required'); return; }
    if (!form.branch_id) { setErr('Branch is required'); return; }
    mut.mutate(form);
  }

  function handleClose() {
    setForm({
      parent_name: '', parent_email: '', parent_phone: '',
      parent_pass: randomPassword(),
      name: '', nickname: '', date_of_birth: '', branch_id: '',
      pre_existing_conditions: '',
    });
    setErr(''); setSuccess(false); setCopied(false);
    onClose();
  }

  async function copyPass() {
    await navigator.clipboard.writeText(form.parent_pass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20 flex items-center justify-between sticky top-0 bg-surface rounded-t-3xl">
          <div>
            <h3 className="text-lg font-bold text-on-surface">{t('students.addStudentTitle')}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{t('students.addStudentHint')}</p>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-emerald-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <p className="font-bold text-on-surface">{t('students.addSuccess')}</p>
            <div className="bg-surface-container rounded-2xl p-4 text-left space-y-1">
              <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{t('students.parentPassword')}</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 font-mono text-sm text-on-surface bg-surface-container-low rounded-xl px-3 py-2">{form.parent_pass}</code>
                <button onClick={copyPass}
                  className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity shrink-0">
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <p className="text-xs text-on-surface-variant mt-2">{t('students.parentPasswordHint')}</p>
            </div>
            <button onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity">
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-5">
              {/* Parent section */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  {t('students.parentInfo')}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('students.parentName')} *
                    </label>
                    <input value={form.parent_name} onChange={e => field('parent_name', e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('students.parentEmail')} *
                    </label>
                    <input type="email" value={form.parent_email} onChange={e => field('parent_email', e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('common.phone')} <span className="normal-case tracking-normal font-normal text-on-surface-variant">({t('common.optional')})</span>
                    </label>
                    <input value={form.parent_phone} onChange={e => field('parent_phone', e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('students.parentPassword')}
                    </label>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm font-mono text-on-surface">
                        {form.parent_pass}
                      </code>
                      <button onClick={() => field('parent_pass', randomPassword())}
                        className="px-3 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-outline-variant/20" />

              {/* Student section */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">child_care</span>
                  {t('students.studentInfoSection')}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('students.fullName')} *
                    </label>
                    <input value={form.name} onChange={e => field('name', e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        {t('students.nickname')} <span className="normal-case tracking-normal font-normal">({t('common.optional')})</span>
                      </label>
                      <input value={form.nickname} onChange={e => field('nickname', e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        {t('students.dob')} <span className="normal-case tracking-normal font-normal">({t('common.optional')})</span>
                      </label>
                      <input type="date" value={form.date_of_birth} onChange={e => field('date_of_birth', e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('students.branchLabel')} *
                    </label>
                    <select value={form.branch_id} onChange={e => field('branch_id', e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">— select —</option>
                      {branches.map((b: any) => (
                        <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('students.preExisting')} <span className="normal-case tracking-normal font-normal">({t('common.optional')})</span>
                    </label>
                    <textarea value={form.pre_existing_conditions} onChange={e => field('pre_existing_conditions', e.target.value)}
                      rows={2} placeholder={t('students.preExistingPlace')}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                </div>
              </div>

              {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3 sticky bottom-0 bg-surface pt-3 border-t border-outline-variant/20 rounded-b-3xl">
              <button onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={submit} disabled={mut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {mut.isPending ? t('students.creating') : t('students.addStudentTitle')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
