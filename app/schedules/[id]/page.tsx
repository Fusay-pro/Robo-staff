'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import AppShell from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import client from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}
function toLocalDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function initials(name: string) {
  return name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_BG = ['#c9e6ff','#c0e8ff','#bee9ff','#e1e2ed','#ffd8b0'];

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  confirmed: { label: 'Confirmed', style: 'bg-emerald-100 text-emerald-800' },
  pending:   { label: 'Pending',   style: 'bg-orange-100 text-orange-800' },
  cancelled: { label: 'Cancelled', style: 'bg-error-container text-on-error-container' },
};

export default function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_owner';

  const [editMode, setEditMode] = useState(false);
  const [sessionForm, setSessionForm] = useState({ date: '', start_time: '', end_time: '', max_capacity: '' });
  const [sessionError, setSessionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: session, isLoading: sessionLoading } = useQuery<any>({
    queryKey: ['schedule', id],
    queryFn: () => client.get(`/schedules/${id}`).then(r => r.data),
  });

  const { data: enrollmentData, isLoading: rosterLoading } = useQuery<any>({
    queryKey: ['enrollments', id],
    queryFn: () => client.get(`/enrollments?schedule_id=${id}&limit=100`).then(r => r.data),
  });

  const enrollments: any[] = enrollmentData?.data ?? [];

  // Edit session mutation
  const sessionMut = useMutation({
    mutationFn: (body: any) => client.patch(`/schedules/${id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', id] });
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-day'] });
      setEditMode(false);
    },
    onError: (e: any) => setSessionError(e.response?.data?.error || 'Failed to update'),
  });

  // Change enrollment status
  const statusMut = useMutation({
    mutationFn: ({ eid, status }: { eid: number; status: string }) =>
      client.patch(`/enrollments/${eid}`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments', id] }),
  });

  // Remove enrollment
  const removeMut = useMutation({
    mutationFn: (eid: number) => client.delete(`/enrollments/${eid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', id] });
      qc.invalidateQueries({ queryKey: ['schedule', id] });
      setDeleteTarget(null);
    },
  });

  function enterEdit() {
    if (!session) return;
    const start = new Date(session.starts_at);
    const end   = new Date(session.ends_at);
    setSessionForm({
      date: toLocalDate(session.starts_at),
      start_time: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
      end_time:   `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`,
      max_capacity: String(session.max_capacity || ''),
    });
    setSessionError('');
    setEditMode(true);
  }

  function saveSession() {
    setSessionError('');
    sessionMut.mutate({
      starts_at:    `${sessionForm.date}T${sessionForm.start_time}:00`,
      ends_at:      `${sessionForm.date}T${sessionForm.end_time}:00`,
      max_capacity: sessionForm.max_capacity ? parseInt(sessionForm.max_capacity) : undefined,
    });
  }

  const fill = session?.max_capacity > 0 ? (session.enrolled_count / session.max_capacity) : 0;
  const sessionName = session?.course_name || session?.contract_school_name || 'Session';
  const isLoading = sessionLoading || rosterLoading;

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-6xl mx-auto w-full">
        {/* Back + title row */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </button>
          {isOwner && !isLoading && (
            editMode ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                  Cancel
                </button>
                <button onClick={saveSession} disabled={sessionMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  {sessionMut.isPending ? 'Savingâ€¦' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button onClick={enterEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit Session
              </button>
            )
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Session card â€” view or edit */}
            <div className={`rounded-3xl p-6 mb-6 transition-all ${editMode ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-surface-container-lowest shadow-sm'}`}>
              {editMode ? (
                /* â”€â”€ EDIT VIEW â”€â”€ */
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Editing Session</p>
                  <h2 className="text-xl font-bold text-on-surface mb-5">{sessionName}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Date</label>
                      <input type="date" value={sessionForm.date}
                        onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full bg-background border border-outline-variant/40 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Start Time</label>
                      <input type="time" value={sessionForm.start_time}
                        onChange={e => setSessionForm(f => ({ ...f, start_time: e.target.value }))}
                        className="w-full bg-background border border-outline-variant/40 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">End Time</label>
                      <input type="time" value={sessionForm.end_time}
                        onChange={e => setSessionForm(f => ({ ...f, end_time: e.target.value }))}
                        className="w-full bg-background border border-outline-variant/40 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Max Capacity</label>
                      <input type="number" min="1" value={sessionForm.max_capacity}
                        onChange={e => setSessionForm(f => ({ ...f, max_capacity: e.target.value }))}
                        placeholder={`Current: ${session?.max_capacity || 'not set'}`}
                        className="w-full bg-background border border-outline-variant/40 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                  {sessionError && (
                    <p className="mt-3 text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{sessionError}</p>
                  )}
                </div>
              ) : (
                /* â”€â”€ READ VIEW â”€â”€ */
                <>
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0ea5e9, #006686)' }}>
                      <span className="material-symbols-outlined text-white text-[26px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        {session?.contract_school_id ? 'school' : 'smart_toy'}
                      </span>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-on-surface">{sessionName}</h1>
                      {session?.starts_at && (
                        <p className="text-on-surface-variant text-sm mt-0.5">
                          {new Date(session.starts_at).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-surface-container rounded-2xl p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Time</p>
                      <p className="font-bold text-on-surface text-sm">{fmtTime(session.starts_at)} â€“ {fmtTime(session.ends_at)}</p>
                    </div>
                    {session?.robot_type_name && (
                      <div className="bg-surface-container rounded-2xl p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Robot</p>
                        <p className="font-bold text-on-surface text-sm">{session.robot_type_name}</p>
                      </div>
                    )}
                    <div className="bg-surface-container rounded-2xl p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Enrolled</p>
                      <p className="font-bold text-on-surface text-sm">{session?.enrolled_count ?? 0}{session?.max_capacity ? ` / ${session.max_capacity}` : ''}</p>
                    </div>
                    {session?.max_capacity > 0 && (
                      <div className="bg-surface-container rounded-2xl p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Capacity</p>
                        <div className="h-2 bg-background rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${fill >= 1 ? 'bg-error' : 'bg-primary'}`}
                            style={{ width: `${Math.min(fill * 100, 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-on-surface-variant mt-1">{Math.round(fill * 100)}% full</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Roster */}
            <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="font-bold text-on-surface text-lg">Student Roster</h3>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">
                  {enrollments.length} enrolled
                </span>
              </div>

              {rosterLoading ? (
                <div className="p-8 flex justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : enrollments.length === 0 ? (
                <div className="py-14 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl block mb-2">group_off</span>
                  <p className="text-sm">No students enrolled yet</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {enrollments.map((e: any, i: number) => (
                    <div key={e.enrollment_id}
                      className={`flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-4 transition-colors ${editMode ? 'hover:bg-primary/5' : 'hover:bg-surface-container-low'}`}>
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-on-surface shrink-0"
                        style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}>
                        {e.student_name ? initials(e.student_name) : '?'}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/students/${e.student_id}`}
                          className="font-semibold text-on-surface hover:text-primary transition-colors truncate block">
                          {e.student_name}
                        </Link>

                        {editMode ? (
                          /* Status toggle buttons */
                          <div className="flex gap-1.5 mt-1.5">
                            {(['confirmed','pending','cancelled'] as const).map(s => (
                              <button key={s}
                                onClick={() => statusMut.mutate({ eid: e.enrollment_id, status: s })}
                                disabled={statusMut.isPending}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide transition-all ${
                                  e.status === s
                                    ? STATUS_CONFIG[s].style + ' ring-2 ring-offset-1 ring-current/30'
                                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                                }`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_CONFIG[e.status]?.style ?? 'bg-surface-container text-on-surface-variant'}`}>
                            {e.status}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      {editMode ? (
                        <button onClick={() => setDeleteTarget(e)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-error-container/0 hover:bg-error-container text-on-surface-variant hover:text-error transition-all shrink-0">
                          <span className="material-symbols-outlined text-[18px]">person_remove</span>
                        </button>
                      ) : (
                        <Link href={`/students/${e.student_id}`}
                          className="shrink-0">
                          <span className="material-symbols-outlined text-outline text-[18px] hover:text-primary transition-colors">chevron_right</span>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Remove student confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-background rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">person_remove</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">Remove Student?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-semibold text-on-surface">{deleteTarget.student_name}</span> will be removed from this session. Their package credit will not be automatically restored.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={() => removeMut.mutate(deleteTarget.enrollment_id)} disabled={removeMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {removeMut.isPending ? 'Removingâ€¦' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

