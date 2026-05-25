'use client';

import AppShell from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

const SESSION_COLORS: Record<string, { border: string; bg: string; icon: string }> = {
  school:   { border: 'border-l-[#0ea5e9]', bg: 'bg-[#0ea5e9]/10', icon: 'text-[#0ea5e9]' },
  lego:     { border: 'border-l-[#f59e0b]', bg: 'bg-[#f59e0b]/10', icon: 'text-[#f59e0b]' },
  vex:      { border: 'border-l-[#10b981]', bg: 'bg-[#10b981]/10', icon: 'text-[#10b981]' },
  arduino:  { border: 'border-l-[#f43f5e]', bg: 'bg-[#f43f5e]/10', icon: 'text-[#f43f5e]' },
  default:  { border: 'border-l-primary',   bg: 'bg-primary/10',   icon: 'text-primary'    },
};

function getColorKey(s: any): keyof typeof SESSION_COLORS {
  if (s.schedule_type === 'contract_school' || s.contract_school_name) return 'school';
  const rt = (s.robot_type_name ?? '').toLowerCase();
  if (rt.includes('lego')) return 'lego';
  if (rt.includes('vex'))  return 'vex';
  if (rt.includes('arduino')) return 'arduino';
  return 'default';
}

// Attendance popup for a single student
function AttendancePopup({
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
        {/* Header */}
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

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Current status */}
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

          {/* Notes field — required */}
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

          {/* Action buttons */}
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

function SessionCard({ s }: { s: any }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<any>(null);
  const qc = useQueryClient();

  const { data: roster = [], isLoading: rosterLoading } = useQuery<any[]>({
    queryKey: ['attendance', s.schedule_id],
    queryFn: () => client.get(`/attendance/${s.schedule_id}`).then(r => r.data),
    enabled: open,
  });

  const markMut = useMutation({
    mutationFn: (body: any) => client.post('/attendance', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', s.schedule_id] });
      setActiveStudent(null);
    },
  });

  const mark = (row: any, status: 'present' | 'absent', notes: string) => {
    markMut.mutate({
      enrollment_id: row.enrollment_id,
      schedule_id: s.schedule_id,
      student_id: row.student_id,
      status,
      notes,
    });
  };

  const isSchool = s.schedule_type === 'contract_school' || !!s.contract_school_name;
  const name = isSchool ? (s.contract_school_name ?? t('today.schoolVisit')) : (s.course_name ?? t('today.session'));
  const typeLabel = s.robot_type_name || (isSchool ? t('today.school') : null);
  const enrolled = s.enrolled_count ?? 0;
  const ck = getColorKey(s);
  const col = SESSION_COLORS[ck];

  const presentCount = roster.filter(r => r.attendance_status === 'present').length;
  const attendancePct = open && roster.length > 0 ? Math.round((presentCount / roster.length) * 100) : null;

  return (
    <>
      <div className={`bg-surface-container-lowest rounded-xl overflow-hidden shadow-md border border-outline-variant/30 border-l-4 ${col.border} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}>
        {/* Card header */}
        <button onClick={() => setOpen(v => !v)} className="w-full p-5 flex items-center gap-4 text-left">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[17px] text-on-surface leading-tight">{name}</h3>
              {typeLabel && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${col.bg} ${col.icon}`}>
                  {typeLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-on-surface-variant text-[13px]">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
              </span>
              <span className="flex items-center gap-1 text-on-surface-variant text-[13px]">
                <span className="material-symbols-outlined text-[13px]">group</span>
                {enrolled} {enrolled !== 1 ? t('today.studentsCount') : t('today.studentCount')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {attendancePct !== null && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[11px] font-bold text-on-surface-variant">{presentCount}/{roster.length}</span>
                <div className="w-16 h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${attendancePct}%`, background: attendancePct === 100 ? '#10b981' : '#006591' }} />
                </div>
              </div>
            )}
            <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${open ? 'bg-primary/10' : 'bg-surface-container'}`}>
              <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${open ? 'rotate-180 text-primary' : 'text-on-surface-variant'}`}>
                expand_more
              </span>
            </div>
          </div>
        </button>

        {/* Expanded roster */}
        {open && (
          <div className="border-t border-outline-variant/20">
            <div className="px-5 py-3 bg-surface-container/40">
              <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">{t('today.attendance')}</span>
            </div>

            <div className="px-5 pb-5 pt-2">
              {rosterLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : roster.length === 0 ? (
                <p className="text-center text-sm text-on-surface-variant py-6">{t('today.noEnrolled')}</p>
              ) : (
                <div className="space-y-2">
                  {roster.map((row: any) => {
                    const isPresent = row.attendance_status === 'present';
                    const isAbsent  = row.attendance_status === 'absent';
                    const classesLeft = row.classes_remaining ?? 0;
                    const isLow = classesLeft > 0 && classesLeft <= 2;
                    const isOut = classesLeft === 0;

                    return (
                      <div key={row.enrollment_id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                          isPresent ? 'bg-success-container/40 border-success-container'
                          : isAbsent ? 'bg-error-container/30 border-error/20'
                          : 'bg-surface-container border-outline-variant/20'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                          isPresent ? 'bg-success/20 text-success'
                          : isAbsent ? 'bg-error/15 text-error'
                          : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {row.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-[14px] text-on-surface block truncate">
                            {row.name}
                            {row.pre_existing_conditions && (
                              <span className="ml-2 text-[10px] text-error font-semibold">{t('today.medicalShort')}</span>
                            )}
                          </span>
                          {row.package_name && (
                            <span className="text-[11px] text-on-surface-variant font-medium">
                              {row.package_name} · <span className={`font-bold ${isOut ? 'text-error' : isLow ? 'text-orange-600' : 'text-on-surface'}`}>
                                {classesLeft} {classesLeft !== 1 ? t('today.classesLeft') : t('today.classLeft')}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Alert pill (low / out of classes) */}
                        {(isLow || isOut) && (
                          <span
                            title={isOut ? t('today.outOfClasses') : t(classesLeft !== 1 ? 'today.onlyLeftPlural' : 'today.onlyLeft', { n: classesLeft })}
                            className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold shrink-0 border ${
                              isOut
                                ? 'bg-error/10 text-error border-error/30 animate-pulse'
                                : 'bg-orange-100 text-orange-700 border-orange-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              notifications_active
                            </span>
                            {isOut ? t('today.noClasses') : `${classesLeft} ${t('today.leftPill')}`}
                          </span>
                        )}

                        {/* Status button */}
                        <button
                          onClick={() => setActiveStudent(row)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all shrink-0 border ${
                            isPresent
                              ? 'bg-success-container text-on-success-container border-success/30 hover:opacity-80'
                              : isAbsent
                              ? 'bg-error-container text-error border-error/30 hover:opacity-80'
                              : 'bg-white text-on-surface-variant border-outline-variant/40 hover:border-primary hover:text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {isPresent ? 'check_circle' : isAbsent ? 'cancel' : 'radio_button_unchecked'}
                          </span>
                          {isPresent ? t('today.present') : isAbsent ? t('today.skipped') : t('today.markAttendance2')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {roster.length > 0 && (
                <div className="mt-3 flex justify-end">
                  <Link href={`/schedules/${s.schedule_id}`}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                    {t('today.fullRoster')}
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Attendance popup */}
      {activeStudent && (
        <AttendancePopup
          row={activeStudent}
          onClose={() => setActiveStudent(null)}
          onMark={(status, notes) => mark(activeStudent, status, notes)}
          isPending={markMut.isPending}
        />
      )}
    </>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="flex-1 bg-surface-container-lowest rounded-xl px-5 py-4 flex items-center gap-3 shadow-md border border-outline-variant/30">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-on-surface leading-none">{value}</p>
        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function offsetDate(base: Date, days: number) {
  const d = new Date(base); d.setDate(d.getDate() + days); return d;
}

export default function TodayPage() {
  const { t } = useT();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [date, setDate] = useState(today);

  const dateStr = toDateString(date);
  const todayStr = toDateString(today);
  const tomorrowStr = toDateString(offsetDate(today, 1));

  type Tab = 'today' | 'tomorrow' | 'other';
  const activeTab: Tab =
    dateStr === todayStr    ? 'today' :
    dateStr === tomorrowStr ? 'tomorrow' : 'other';

  const setTab = (tab: Tab) => {
    if (tab === 'today') setDate(new Date(today));
    else if (tab === 'tomorrow') setDate(offsetDate(today, 1));
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'today',    label: t('today.tabToday') },
    { key: 'tomorrow', label: t('today.tabTomorrow') },
  ];

  const longDate = (() => {
    const wd = DAY_KEYS[date.getDay()];
    return `${t(`date.daysLong.${wd}`)}, ${date.getDate()} ${t(`date.months.${date.getMonth() + 1}`)} ${date.getFullYear()}`;
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['schedules-day', dateStr],
    queryFn: () => client.get(`/schedules?date=${dateStr}&limit=50&offset=0`).then(r => r.data?.data ?? []),
  });

  const sessions: any[] = data ?? [];
  const totalStudents = sessions.reduce((sum, s) => sum + (s.enrolled_count ?? 0), 0);
  const schoolSessions = sessions.filter(s => s.schedule_type === 'contract_school' || !!s.contract_school_name).length;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 md:px-8 w-full pb-24 md:pb-8">

        {/* Sticky date header */}
        <div className="sticky top-0 z-30 bg-surface-container-low/95 backdrop-blur-md py-4 space-y-3">

          {/* Date label */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-[20px] text-on-surface leading-tight">
                {activeTab === 'today'    ? t('today.yourSessions') :
                 activeTab === 'tomorrow' ? t('today.tomorrowSessions') :
                 longDate}
              </p>
              <p className="text-[12px] text-on-surface-variant mt-0.5">{longDate}</p>
            </div>

          </div>

          {/* Quick tabs */}
          <div className="flex gap-2 bg-surface-container-lowest rounded-2xl p-1.5 shadow-sm border border-outline-variant/30">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        {!isLoading && sessions.length > 0 && (
          <div className="flex gap-3 mt-1 mb-4">
            <StatCard icon="event_note" label={t('today.statSessions')}       value={sessions.length} color="bg-primary" />
            <StatCard icon="group"      label={t('today.statTotalStudents')} value={totalStudents}   color="bg-[#10b981]" />
            {schoolSessions > 0 && (
              <StatCard icon="school"   label={t('today.statSchoolVisits')}  value={schoolSessions}  color="bg-[#0ea5e9]" />
            )}
          </div>
        )}

        {/* Sessions */}
        <div className="pb-8 space-y-3">
          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="h-20 bg-surface-container-lowest animate-pulse rounded-xl border border-outline-variant/20" />)
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant/30">
              <span className="material-symbols-outlined text-5xl text-outline block mb-3">event_busy</span>
              <p className="font-bold text-on-surface mb-1">{t('today.noScheduled')}</p>
              <p className="text-sm text-on-surface-variant">
                {activeTab === 'today' ? t('today.enjoyQuiet') : t('today.nothingThisDay')}
              </p>
            </div>
          ) : (
            sessions.map((s: any) => (
              <SessionCard key={s.schedule_id} s={s} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
