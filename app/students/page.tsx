'use client';

import AppShell from '@/components/AppShell';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import client from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { useT } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import AddStudentModal from './_components/AddStudentModal';

const PAGE_SIZE = 20;

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function StudentsPage() {
  const { t } = useT();
  const { role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_owner';
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [page, setPage] = useState(0);
  const [accumulated, setAccumulated] = useState<any[]>([]);

  useEffect(() => {
    const tm = setTimeout(() => { setDebouncedSearch(search); setPage(0); setAccumulated([]); }, 350);
    return () => clearTimeout(tm);
  }, [search]);

  useEffect(() => { setPage(0); setAccumulated([]); }, [statusFilter]);

  const { data: statsData } = useQuery<any>({
    queryKey: ['students-stats'],
    queryFn: () => client.get('/students/stats').then(r => r.data),
    staleTime: 60_000,
  });

  const approvalParam = statusFilter === 'all' ? '' : `&approval_status=${statusFilter}`;
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';

  const { data: pageData, isLoading, isFetching } = useQuery<{ data: any[]; total: number }>({
    queryKey: ['students-list', debouncedSearch, statusFilter, page],
    queryFn: () =>
      client.get(`/students?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}${approvalParam}${searchParam}`)
        .then(r => ({ data: r.data?.data ?? [], total: r.data?.total ?? 0 })),
  });

  // Merge page data into accumulated list
  useEffect(() => {
    if (!pageData?.data) return;
    if (page === 0) {
      setAccumulated(pageData.data);
    } else {
      setAccumulated(prev => {
        const ids = new Set(prev.map((s: any) => s.student_id));
        return [...prev, ...pageData.data.filter((s: any) => !ids.has(s.student_id))];
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageData]);

  // Always show at least the latest page data on first load (handles cached queries)
  const displayList = page === 0 && accumulated.length === 0 && pageData?.data
    ? pageData.data
    : accumulated;

  const total = pageData?.total ?? 0;
  const hasMore = displayList.length < total;

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold text-on-surface">{t('students.title')}</h2>
            <p className="text-on-surface-variant mt-1 text-sm">{t('students.subtitle2')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <button onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span className="hidden sm:inline">{t('students.addStudentTitle')}</span>
              </button>
            )}
          <button onClick={() => downloadCsv('students', displayList, [
            { key: 'name',                label: 'Name' },
            { key: 'nickname',            label: 'Nickname' },
            { key: 'age',                 label: 'Age' },
            { key: 'approval_status',     label: 'Status' },
            { key: 'classes_remaining',   label: 'Classes Left' },
            { key: 'active_package_name', label: 'Package' },
            { key: 'parent_name',         label: 'Parent' },
            { key: 'parent_phone',        label: 'Phone' },
          ])}
          disabled={displayList.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container hover:border-primary/40 transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="hidden sm:inline">{t('common.exportCsv')}</span>
          </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 xl:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-container-lowest rounded-2xl p-3 md:p-5 flex items-center gap-4 shadow-sm border border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-primary/10 hidden md:flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-extrabold text-on-surface">{statsData?.total ?? '—'}</p>
              <p className="text-xs text-on-surface-variant font-medium">{t('students.totalStudents')}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-3 md:p-5 flex items-center gap-4 shadow-sm border border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 hidden md:flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-700 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>card_membership</span>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-extrabold text-on-surface">{statsData?.with_active_package ?? '—'}</p>
              <p className="text-xs text-on-surface-variant font-medium">{t('students.activePackagesStat')}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl p-3 md:p-5 flex items-center gap-4 shadow-sm border border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-orange-100 hidden md:flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-orange-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-extrabold text-on-surface">{statsData?.low_classes ?? '—'}</p>
              <p className="text-xs text-on-surface-variant font-medium">{t('students.lowOnClasses')}</p>
            </div>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl px-3 py-2.5 border border-outline-variant/40 shadow-sm flex-1 min-w-52">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('students.searchByName')}
              className="bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant flex-1"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex gap-1 bg-surface-container-lowest rounded-xl p-1 border border-outline-variant/20">
            {(['all', 'approved', 'pending'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                {t(`students.tab.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        {isLoading && page === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-surface-container-low animate-pulse rounded-2xl" />)}
          </div>
        ) : displayList.length === 0 ? (
          <div className="py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-outline block mb-3">person_search</span>
            <p className="font-semibold text-on-surface-variant">{t('students.noFound')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayList.map((s: any) => {
                const isApproved = s.approval_status === 'approved';
                const isPending  = s.approval_status === 'pending';
                const classesLeft = s.classes_remaining ?? 0;
                const barPct = Math.min((classesLeft / 10) * 100, 100);
                const isLow = classesLeft > 0 && classesLeft <= 2;

                return (
                  <Link key={s.student_id} href={`/students/${s.student_id}`}
                    className="group bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md transition-all flex gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md shadow-primary/20">
                      {s.name ? initials(s.name) : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-bold text-on-surface text-base group-hover:text-primary transition-colors leading-tight">{s.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {s.age && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                                {t('approvals.ageLabel')} {s.age}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isApproved ? 'bg-emerald-100 text-emerald-700'
                              : isPending ? 'bg-orange-100 text-orange-700'
                              : 'bg-error/10 text-error'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : isPending ? 'bg-orange-400' : 'bg-error'}`} />
                              {isApproved ? t('students.status.approved') : isPending ? t('students.status.pending') : t('students.status.rejected')}
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary transition-colors shrink-0">chevron_right</span>
                      </div>

                      <div className="bg-surface-container rounded-xl px-4 py-2.5 mt-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">{t('students.classesLeftLabel')}</p>
                          <p className={`text-2xl font-extrabold leading-none ${isLow ? 'text-error' : 'text-on-surface'}`}>{classesLeft}</p>
                        </div>
                        <div className="flex-1 max-w-[140px]">
                          <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isLow ? 'bg-error' : 'bg-primary'}`}
                              style={{ width: `${barPct}%` }} />
                          </div>
                          {classesLeft === 0 && (
                            <p className="text-[10px] text-error font-semibold mt-1">{t('students.needsRenewal')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={isFetching}
                  className="px-8 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-sm font-bold text-on-surface hover:bg-surface-container hover:border-primary/20 transition-all disabled:opacity-50">
                  {isFetching ? t('students.loading') : `${t('students.loadMore')} (${total - displayList.length} ${t('students.remaining')})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </AppShell>
  );
}
