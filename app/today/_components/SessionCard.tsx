'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';
import AttendancePopup from './AttendancePopup';

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

export default function SessionCard({ s }: { s: any }) {
  const { t } = useT();
  const router = useRouter();
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
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              router.push(`/schedules/${s.schedule_id}`);
            } else {
              setOpen(v => !v);
            }
          }}
          className="w-full p-3.5 md:p-5 flex items-center gap-3 md:gap-4 text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[15px] md:text-[17px] text-on-surface leading-tight">{name}</h3>
              {typeLabel && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${col.bg} ${col.icon}`}>
                  {typeLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-on-surface-variant text-[12px] md:text-[13px]">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
              </span>
              <span className="flex items-center gap-1 text-on-surface-variant text-[12px] md:text-[13px]">
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
              <span className="material-symbols-outlined text-[18px] md:hidden text-on-surface-variant">chevron_right</span>
              <span className={`material-symbols-outlined text-[18px] hidden md:block transition-transform duration-300 ${open ? 'rotate-180 text-primary' : 'text-on-surface-variant'}`}>
                expand_more
              </span>
            </div>
          </div>
        </button>

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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                          isPresent ? 'bg-success/20 text-success'
                          : isAbsent ? 'bg-error/15 text-error'
                          : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          {row.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>

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
