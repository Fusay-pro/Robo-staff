'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

interface Props {
  open:    boolean;
  onClose: () => void;
}

interface StudentForm {
  name: string; nickname: string; date_of_birth: string;
  branch_id: string; pre_existing_conditions: string;
}

function randomPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function emptyStudent(): StudentForm {
  return { name: '', nickname: '', date_of_birth: '', branch_id: '', pre_existing_conditions: '' };
}

export default function AddStudentModal({ open, onClose }: Props) {
  const { t } = useT();
  const qc = useQueryClient();

  const [mode, setMode] = useState<'new' | 'existing'>('new');

  // new-parent fields
  const [parentForm, setParentForm] = useState({
    parent_name: '', parent_email: '', parent_phone: '', parent_pass: randomPassword(),
  });

  // existing-parent search
  const [parentSearch, setParentSearch]       = useState('');
  const [parentDebSearch, setParentDebSearch] = useState('');
  const [selectedParent, setSelectedParent]   = useState<any>(null);

  // multiple students
  const [students, setStudents] = useState<StudentForm[]>([emptyStudent()]);

  const [err, setErr]         = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied]   = useState(false);

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn:  () => client.get('/branches').then(r => r.data?.data ?? r.data),
    enabled:  open,
  });

  const { data: parentResults = [] } = useQuery<any[]>({
    queryKey: ['parents-search', parentDebSearch],
    queryFn:  () => client.get(`/users/parents?search=${encodeURIComponent(parentDebSearch)}`).then(r => r.data.data),
    enabled:  open && mode === 'existing',
  });

  const mut = useMutation({
    mutationFn: async () => {
      let parentUserId: number;

      if (mode === 'new') {
        const { data: parent } = await client.post('/users', {
          name:     parentForm.parent_name,
          email:    parentForm.parent_email,
          phone:    parentForm.parent_phone || undefined,
          password: parentForm.parent_pass,
          role:     'parent',
        });
        parentUserId = parent.user_id;
      } else {
        parentUserId = selectedParent.user_id;
      }

      for (const s of students) {
        const { data: created } = await client.post('/students', {
          name:                    s.name,
          nickname:                s.nickname || undefined,
          date_of_birth:           s.date_of_birth || undefined,
          branch_id:               parseInt(s.branch_id),
          pre_existing_conditions: s.pre_existing_conditions || undefined,
          parent_user_id:          parentUserId,
        });
        await client.patch(`/confirmations/${created.student_id}`, { status: 'approved' });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students-list'] });
      qc.invalidateQueries({ queryKey: ['students-stats'] });
      setSuccess(true);
    },
    onError: (e: any) => setErr(e?.response?.data?.error || t('students.failedCreate')),
  });

  function studentField(i: number, key: keyof StudentForm, val: string) {
    setStudents(ss => ss.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
    setErr('');
  }

  function addStudent() {
    setStudents(ss => [...ss, emptyStudent()]);
  }

  function removeStudent(i: number) {
    setStudents(ss => ss.filter((_, idx) => idx !== i));
  }

  function parentField(key: keyof typeof parentForm, val: string) {
    setParentForm(f => ({ ...f, [key]: val }));
    setErr('');
  }

  function submit() {
    setErr('');
    if (mode === 'new') {
      if (!parentForm.parent_name.trim())  { setErr('Parent name is required');  return; }
      if (!parentForm.parent_email.trim()) { setErr('Parent email is required'); return; }
    } else {
      if (!selectedParent) { setErr('Please select a parent'); return; }
    }
    for (let i = 0; i < students.length; i++) {
      if (!students[i].name.trim())     { setErr(`Child ${i + 1}: name is required`);   return; }
      if (!students[i].branch_id)       { setErr(`Child ${i + 1}: branch is required`); return; }
    }
    mut.mutate();
  }

  function handleClose() {
    setMode('new');
    setParentForm({ parent_name: '', parent_email: '', parent_phone: '', parent_pass: randomPassword() });
    setParentSearch(''); setParentDebSearch(''); setSelectedParent(null);
    setStudents([emptyStudent()]);
    setErr(''); setSuccess(false); setCopied(false);
    onClose();
  }

  function switchMode(m: 'new' | 'existing') {
    setMode(m);
    setSelectedParent(null);
    setParentSearch(''); setParentDebSearch('');
    setErr('');
  }

  async function copyPass() {
    await navigator.clipboard.writeText(parentForm.parent_pass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20 flex items-center justify-between sticky top-0 bg-surface rounded-t-3xl z-10">
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
            <p className="font-bold text-on-surface">
              {students.length > 1 ? `${students.length} students added!` : t('students.addSuccess')}
            </p>
            {mode === 'new' && (
              <div className="bg-surface-container rounded-2xl p-4 text-left space-y-1">
                <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">{t('students.parentPassword')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 font-mono text-sm text-on-surface bg-surface-container-low rounded-xl px-3 py-2">{parentForm.parent_pass}</code>
                  <button onClick={copyPass}
                    className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity shrink-0">
                    {copied ? t('common.copied') : t('common.copy')}
                  </button>
                </div>
                <p className="text-xs text-on-surface-variant mt-2">{t('students.parentPasswordHint')}</p>
              </div>
            )}
            <button onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity">
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-5">

              {/* Mode toggle */}
              <div className="flex rounded-xl bg-surface-container-low p-1 gap-1">
                <button onClick={() => switchMode('new')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${mode === 'new' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                  New Parent
                </button>
                <button onClick={() => switchMode('existing')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${mode === 'existing' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                  Existing Parent
                </button>
              </div>

              {/* Parent section */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  {t('students.parentInfo')}
                </p>

                {mode === 'new' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.parentName')} *</label>
                      <input value={parentForm.parent_name} onChange={e => parentField('parent_name', e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.parentEmail')} *</label>
                      <input type="email" value={parentForm.parent_email} onChange={e => parentField('parent_email', e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                        {t('common.phone')} <span className="normal-case tracking-normal font-normal text-on-surface-variant">({t('common.optional')})</span>
                      </label>
                      <input value={parentForm.parent_phone} onChange={e => parentField('parent_phone', e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.parentPassword')}</label>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm font-mono text-on-surface">
                          {parentForm.parent_pass}
                        </code>
                        <button onClick={() => parentField('parent_pass', randomPassword())}
                          className="px-3 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-colors">
                          <span className="material-symbols-outlined text-[18px]">refresh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5">
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
                      <input
                        value={parentSearch}
                        onChange={e => {
                          setParentSearch(e.target.value);
                          setSelectedParent(null);
                          clearTimeout((window as any).__parentDebounce);
                          (window as any).__parentDebounce = setTimeout(() => setParentDebSearch(e.target.value), 350);
                        }}
                        placeholder="Search by name or email…"
                        className="flex-1 bg-transparent text-sm focus:outline-none"
                      />
                      {parentSearch && (
                        <button onClick={() => { setParentSearch(''); setParentDebSearch(''); setSelectedParent(null); }}>
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">close</span>
                        </button>
                      )}
                    </div>

                    {selectedParent ? (
                      <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/30 rounded-xl">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {selectedParent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface">{selectedParent.name}</p>
                          <p className="text-xs text-on-surface-variant truncate">{selectedParent.email}</p>
                        </div>
                        <button onClick={() => setSelectedParent(null)} className="text-on-surface-variant hover:text-on-surface">
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    ) : parentDebSearch && parentResults.length === 0 ? (
                      <p className="text-xs text-on-surface-variant text-center py-4">No parents found</p>
                    ) : parentResults.length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {parentResults.map((p: any) => (
                          <button key={p.user_id} onClick={() => { setSelectedParent(p); setErr(''); }}
                            className="w-full flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary text-xs font-bold shrink-0">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-on-surface">{p.name}</p>
                              <p className="text-xs text-on-surface-variant truncate">{p.email}</p>
                            </div>
                            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">add</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-outline-variant/20" />

              {/* Students section */}
              <div className="space-y-4">
                {students.map((s, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">child_care</span>
                        {students.length > 1 ? `Child ${i + 1}` : t('students.studentInfoSection')}
                      </p>
                      {students.length > 1 && (
                        <button onClick={() => removeStudent(i)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors">
                          <span className="material-symbols-outlined text-[16px]">remove</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.fullName')} *</label>
                        <input value={s.name} onChange={e => studentField(i, 'name', e.target.value)}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                            {t('students.nickname')} <span className="normal-case tracking-normal font-normal">({t('common.optional')})</span>
                          </label>
                          <input value={s.nickname} onChange={e => studentField(i, 'nickname', e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                            {t('students.dob')} <span className="normal-case tracking-normal font-normal">({t('common.optional')})</span>
                          </label>
                          <input type="date" value={s.date_of_birth} onChange={e => studentField(i, 'date_of_birth', e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('students.branchLabel')} *</label>
                        <select value={s.branch_id} onChange={e => studentField(i, 'branch_id', e.target.value)}
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
                        <textarea value={s.pre_existing_conditions} onChange={e => studentField(i, 'pre_existing_conditions', e.target.value)}
                          rows={2} placeholder={t('students.preExistingPlace')}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                      </div>
                    </div>
                    {i < students.length - 1 && <div className="border-t border-outline-variant/20 mt-4" />}
                  </div>
                ))}

                {/* Add another child */}
                <button onClick={addStudent}
                  className="w-full py-2.5 rounded-xl border border-dashed border-outline-variant/50 text-xs font-bold text-on-surface-variant hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add another child
                </button>
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
                {mut.isPending ? t('students.creating') : students.length > 1 ? `Add ${students.length} Students` : t('students.addStudentTitle')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
