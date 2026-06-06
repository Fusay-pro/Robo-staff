'use client';

import AppShell from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import client from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import AssignCourseModal from './_components/AssignCourseModal';
import EditPackageModal  from './_components/EditPackageModal';
import DeletePackageModal from './_components/DeletePackageModal';
import EditStudentModal  from './_components/EditStudentModal';

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const { t } = useT();
  const isOwner = role === 'owner' || role === 'super_owner';

  const { data: student, isLoading, isError } = useQuery<any>({
    queryKey: ['student', id],
    queryFn: () => client.get(`/students/${id}`).then(r => r.data),
  });

  const qc = useQueryClient();
  const [noteEdit, setNoteEdit] = useState(false);
  const [noteText, setNoteText] = useState('');

  // All packages (active + inactive) for this student
  const { data: allPackages = [] } = useQuery<any[]>({
    queryKey: ['student-packages', id, 'all'],
    queryFn: () => client.get(`/customer-packages?student_id=${id}&all=true`).then(r => r.data),
    enabled: !!id,
  });

  const restorePkg = useMutation({
    mutationFn: (cpId: number) =>
      client.patch(`/customer-packages/${cpId}`, { is_active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-packages', id] });
      qc.invalidateQueries({ queryKey: ['student', id] });
    },
  });

  const [deletePkgTarget, setDeletePkgTarget] = useState<any>(null);
  const [editPkgTarget, setEditPkgTarget]     = useState<any>(null);
  const [showInactive, setShowInactive]       = useState(false);
  const [editKidOpen, setEditKidOpen]         = useState(false);
  const [addPkgOpen, setAddPkgOpen]           = useState(false);

  const { data: notes = [] } = useQuery<any[]>({
    queryKey: ['student-notes', id],
    queryFn: () => client.get(`/students/${id}/notes`).then(r => r.data),
  });

  const addNote = useMutation({
    mutationFn: (body: string) => client.post(`/students/${id}/notes`, { body }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-notes', id] });
      setNoteEdit(false);
      setNoteText('');
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-12 flex justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (isError || !student) {
    return (
      <AppShell>
        <div className="p-12 text-center">
          <p className="text-on-surface-variant mb-4">{t('students.couldNotLoad')}</p>
          <button onClick={() => router.back()} className="text-primary font-semibold hover:underline">{t('students.goBack')}</button>
        </div>
      </AppShell>
    );
  }

  const isApproved = student.approval_status === 'approved';
  const isPending  = student.approval_status === 'pending';
  const hasPackage = student.packages?.length > 0;
  const initStr = student.name ? initials(student.name) : '?';
  const latestNote = notes[0];

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-6xl mx-auto w-full">
        {/* Back */}
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-primary mb-6 transition-colors">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('students.back')}
        </button>

        {/* Hero */}
        <div className="bg-surface-container-lowest rounded-3xl p-8 flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
          <div className="w-28 h-28 rounded-full bg-primary flex items-center justify-center text-white text-4xl font-bold shrink-0 shadow-lg">
            {initStr}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-start justify-center md:justify-start gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-on-surface">{student.name}</h1>
              {isOwner && (
                <button onClick={() => setEditKidOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  {t('students.editLabel')}
                </button>
              )}
            </div>
            {student.nickname && <p className="text-on-surface-variant mt-0.5">"{student.nickname}"</p>}
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                isApproved ? 'bg-emerald-100 text-emerald-800'
                : isPending ? 'bg-orange-100 text-orange-800'
                : 'bg-error-container text-on-error-container'
              }`}>
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isApproved ? 'check_circle' : 'pending'}
                </span>
                {isApproved ? t('students.status.approved') : isPending ? t('students.status.pending') : t('students.status.rejected')}
              </span>
              {hasPackage && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>package_2</span>
                  {t('students.active')}
                </span>
              )}
              {student.branch_name && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {student.branch_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Student info — left */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-primary mb-6">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
              {t('students.studentInformation')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
              {[
                { label: t('students.dob'), value: student.date_of_birth ? (() => { const dt = new Date(student.date_of_birth); return `${dt.getDate()} ${t(`date.months.${dt.getMonth() + 1}`)} ${dt.getFullYear()}`; })() : student.age ? `${t('approvals.ageLabel')} ${student.age}` : '—' },
                { label: t('students.school'), value: student.school_name || '—' },
                { label: t('students.parentName'), value: student.parent_name || '—' },
                { label: t('students.parentPhone'), value: student.parent_phone || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant mb-1">{label}</p>
                  <p className="font-semibold text-on-surface">{value}</p>
                </div>
              ))}
              {student.parent_email && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant mb-1">{t('students.parentEmail')}</p>
                  <p className="font-semibold text-on-surface">{student.parent_email}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant mb-1">{t('students.joinedDate')}</p>
                <p className="font-semibold text-on-surface">
                  {(() => { const dt = new Date(student.created_at); return `${dt.getDate()} ${t(`date.months.${dt.getMonth() + 1}`)} ${dt.getFullYear()}`; })()}
                </p>
              </div>
            </div>

            {student.pre_existing_conditions && (
              <div className="mt-6 pt-6 border-t border-outline-variant/30">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-error-container/20">
                  <span className="material-symbols-outlined text-error shrink-0">info</span>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-error mb-1">{t('students.medicalNote')}</p>
                    <p className="text-sm text-on-surface">{student.pre_existing_conditions}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column: packages + notes */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Packages — all (active + inactive) with toggle */}
            <div className="bg-surface-container-lowest rounded-3xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
                  <span className="material-symbols-outlined">inventory_2</span>
                  {t('students.packages')}
                </h2>
                {isOwner && (
                  <button onClick={() => setAddPkgOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-[14px]">add</span> {t('common.add')}
                  </button>
                )}
              </div>

              {(() => {
                const active   = allPackages.filter((p: any) => p.is_active);
                const inactive = allPackages.filter((p: any) => !p.is_active);
                const visible  = showInactive ? allPackages : active;
                if (allPackages.length === 0) {
                  return (
                    <div className="text-center text-on-surface-variant py-6">
                      <span className="material-symbols-outlined text-3xl block mb-2">package_2</span>
                      <p className="text-sm">{t('students.noPackagesYet')}</p>
                      {isOwner && <p className="text-xs mt-1">{t('students.clickAddHint')}</p>}
                    </div>
                  );
                }
                return (
                <div className="space-y-3">
                  {visible.map((p: any) => {
                    const used = p.class_count - (p.classes_remaining ?? 0);
                    const pct = p.class_count > 0 ? (used / p.class_count) * 100 : 0;
                    const out = p.classes_remaining === 0;
                    return (
                      <div key={p.customer_package_id}
                        className={`rounded-2xl border p-4 transition-all ${
                          p.is_active
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-surface-container-low border-outline-variant/30 opacity-70'
                        }`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface text-sm truncate">{p.package_name}</p>
                            <p className="text-[11px] text-on-surface-variant truncate">
                              {p.course_name}{p.robot_type_name ? ` · ${p.robot_type_name}` : ''}
                            </p>
                          </div>
                          {isOwner ? (
                            p.is_active ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setEditPkgTarget(p)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors"
                                  title={t('students.editPkg')}>
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  onClick={() => setDeletePkgTarget(p)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                                  title={t('students.removeThis')}>
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => restorePkg.mutate(p.customer_package_id)}
                                disabled={restorePkg.isPending}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors shrink-0"
                                title={t('students.restoreThis')}>
                                {t('students.restore')}
                              </button>
                            )
                          ) : (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'
                            }`}>
                              {p.is_active ? t('students.active') : t('students.inactive')}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-on-surface-variant">{used} / {p.class_count} {t('students.used')}</span>
                          <span className={`font-bold ${out ? 'text-error' : 'text-primary'}`}>
                            {p.classes_remaining} {t('students.left')}
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${out ? 'bg-error' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {inactive.length > 0 && (
                    <button onClick={() => setShowInactive(v => !v)}
                      className="w-full text-center text-xs text-on-surface-variant hover:text-primary font-semibold py-2 transition-colors">
                      {showInactive ? t('students.hide') : t('students.show')} {inactive.length} {inactive.length !== 1 ? t('students.removedPackages') : t('students.removedPackage')}
                    </button>
                  )}
                </div>
                );
              })()}
            </div>

            {/* Staff notes */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
                  <span className="material-symbols-outlined">description</span>
                  {t('students.staffNotes')}
                </h2>
                {!noteEdit && (
                  <button onClick={() => { setNoteText(''); setNoteEdit(true); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                )}
              </div>

              {noteEdit ? (
                <div className="space-y-3">
                  <textarea rows={4} value={noteText} onChange={e => setNoteText(e.target.value)}
                    placeholder={t('students.addNotePlace')}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <div className="flex gap-2">
                    <button onClick={() => setNoteEdit(false)}
                      className="flex-1 py-2 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => noteText.trim() && addNote.mutate(noteText.trim())}
                      disabled={!noteText.trim() || addNote.isPending}
                      className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                      {addNote.isPending ? t('common.saving') : t('students.saveNote')}
                    </button>
                  </div>
                </div>
              ) : latestNote ? (
                <div>
                  <div className="bg-surface-container rounded-xl p-4 mb-3">
                    <p className="text-sm text-on-surface italic leading-relaxed">"{latestNote.body}"</p>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px]">update</span>
                    {latestNote.author_name} · {(() => { const dt = new Date(latestNote.created_at); return `${dt.getDate()} ${t(`date.monthsShort.${dt.getMonth() + 1}`)}`; })()}
                  </p>
                  {notes.length > 1 && (
                    <p className="text-xs text-primary mt-2 font-semibold">+{notes.length - 1} {notes.length > 2 ? t('students.moreNotesPlural') : t('students.moreNotes')}</p>
                  )}
                </div>
              ) : (
                <div className="text-center text-on-surface-variant py-4">
                  <p className="text-sm">{t('students.noNotes')}</p>
                  <button onClick={() => setNoteEdit(true)} className="text-xs text-primary font-semibold mt-2 hover:underline">{t('students.addFirstNote')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AssignCourseModal open={addPkgOpen} studentId={id} onClose={() => setAddPkgOpen(false)} />
      <EditPackageModal target={editPkgTarget} studentId={id} onClose={() => setEditPkgTarget(null)} />
      <DeletePackageModal target={deletePkgTarget} studentId={id} onClose={() => setDeletePkgTarget(null)} />
      <EditStudentModal open={editKidOpen} student={student} studentId={id} onClose={() => setEditKidOpen(false)} />
    </AppShell>
  );
}
