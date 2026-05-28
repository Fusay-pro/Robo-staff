'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import AppShell from '@/components/AppShell';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import client from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { useT } from '@/context/I18nContext';

const MONTH_KEYS_EN = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#c9e6ff','#c0e8ff','#bee9ff','#e1e2ed','#ffdad6'];

export default function FinancesPage() {
  const today = new Date();
  const { t } = useT();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear] = useState(today.getFullYear());
  const monthLabel = (m: number) => t(`date.months.${m + 1}`);
  const monthShort = (m: number) => t(`date.monthsShort.${m + 1}`);
  const statusLabel = (s: string) => {
    if (s === 'paid')     return t('finances.paid');
    if (s === 'refunded') return t('finances.refunded');
    if (s === 'unpaid')   return t('finances.unpaid');
    return s || t('finances.unknown');
  };

  const { data: packages = [], isLoading } = useQuery<any[]>({
    queryKey: ['customer-packages'],
    queryFn: () => client.get('/customer-packages?limit=200').then(r => r.data?.data ?? r.data ?? []),
  });

  const total    = packages.reduce((s: number, p: any) => s + Number(p.price || 0), 0);
  const paid     = packages.filter((p: any) => p.payment_status === 'paid');
  const paidTotal = paid.reduce((s: number, p: any) => s + Number(p.price || 0), 0);
  const pendingTotal = total - paidTotal;
  const collectedPct = total > 0 ? Math.round((paidTotal / total) * 100) : 0;
  const pendingPct   = total > 0 ? Math.round((pendingTotal / total) * 100) : 0;

  const recentMonths = [-2, -1, 0].map(offset => {
    const d = new Date(selectedYear, today.getMonth() + offset, 1);
    return { label: monthShort(d.getMonth()), month: d.getMonth(), year: d.getFullYear() };
  });

  const filtered = packages.filter((p: any) => {
    const d = new Date(p.created_at);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const displayed = filtered.length > 0 ? filtered : packages.slice(0, 20);

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 h-full">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold text-on-surface">{t('finances.title')}</h2>
            <p className="text-on-surface-variant mt-1">{t('finances.subtitle2')}</p>
          </div>
          <button onClick={() => downloadCsv(`finances-${MONTH_KEYS_EN[selectedMonth]}-${selectedYear}`, displayed, [
            { key: 'student_name',   label: 'Student' },
            { key: 'package_name',   label: 'Package' },
            { key: 'price',          label: 'Amount (THB)' },
            { key: 'created_at',     label: 'Date', format: (_r: any, v: any) => v ? new Date(v).toLocaleDateString('en-CA') : '' },
            { key: 'payment_status', label: 'Status' },
          ])}
          disabled={displayed.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container hover:border-primary/40 transition-colors disabled:opacity-50 shrink-0">
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="hidden sm:inline">{t('common.exportCsv')}</span>
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-container-lowest rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary-fixed">payments</span>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>{t('finances.totalLabel')}
              </span>
            </div>
            <p className="text-xs font-semibold tracking-wider text-on-surface-variant uppercase mb-1">{t('finances.totalRevenue2')}</p>
            <p className="text-3xl font-extrabold text-primary">à¸¿{total.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant mt-2">{t('finances.allEnrolledPkgs')}</p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl bg-secondary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-on-secondary-fixed">account_balance_wallet</span>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>{collectedPct}%
              </span>
            </div>
            <p className="text-xs font-semibold tracking-wider text-on-surface-variant uppercase mb-1">{t('finances.collected')}</p>
            <p className="text-3xl font-extrabold text-secondary">à¸¿{paidTotal.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant mt-2">{t('finances.cleared')}</p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl bg-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-on-error-container">pending_actions</span>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-error bg-error-container/50 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">schedule</span>{pendingPct}%
              </span>
            </div>
            <p className="text-xs font-semibold tracking-wider text-on-surface-variant uppercase mb-1">{t('finances.pending')}</p>
            <p className="text-3xl font-extrabold text-error">à¸¿{pendingTotal.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant mt-2">{t('finances.overdue')}</p>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-surface-container-lowest rounded-3xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-on-surface">{t('finances.recentTransactions')}</h3>
              <p className="text-sm text-on-surface-variant">{t('finances.recentTransactionsHint')}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentMonths.map(({ month, year }) => (
                <button key={`${year}-${month}`}
                  onClick={() => setSelectedMonth(month)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedMonth === month
                      ? 'bg-primary text-white'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}>
                  {monthLabel(month)}
                </button>
              ))}
              <button onClick={() => setSelectedMonth(-1)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedMonth === -1
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}>
                {t('finances.viewAll')}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-14 bg-surface-container animate-pulse rounded-xl" />)}
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl block mb-2">receipt_long</span>
              {t('finances.noTransactions')}
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden divide-y divide-outline-variant/20">
                {displayed.map((p: any, i: number) => {
                  const name = p.student_name || 'â€”';
                  const abbr = name !== 'â€”' ? initials(name) : '??';
                  const bg = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const isPaid = p.payment_status === 'paid';
                  return (
                    <div key={p.customer_package_id ?? i} className="py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-on-surface shrink-0" style={{ background: bg }}>
                        {abbr}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface text-sm truncate">{name}</p>
                        <p className="text-xs text-on-surface-variant truncate">{p.package_name || 'â€”'}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                          {p.created_at ? (() => { const dt = new Date(p.created_at); return `${dt.getDate()} ${monthShort(dt.getMonth())}`; })() : 'â€”'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-bold text-sm text-on-surface">{p.price ? `à¸¿${Number(p.price).toLocaleString()}` : 'â€”'}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isPaid ? 'bg-emerald-100 text-emerald-800'
                            : p.payment_status === 'refunded' ? 'bg-error-container text-on-error-container'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {statusLabel(p.payment_status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant border-b border-outline-variant/30">
                      <th className="pb-3 px-4">{t('finances.studentName')}</th>
                      <th className="pb-3 px-4">{t('finances.packageName')}</th>
                      <th className="pb-3 px-4 text-right">{t('finances.amountCol')}</th>
                      <th className="pb-3 px-4">{t('finances.dateCol')}</th>
                      <th className="pb-3 px-4">{t('finances.statusCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {displayed.map((p: any, i: number) => {
                      const name = p.student_name || 'â€”';
                      const abbr = name !== 'â€”' ? initials(name) : '??';
                      const bg = AVATAR_COLORS[i % AVATAR_COLORS.length];
                      const isPaid = p.payment_status === 'paid';
                      return (
                        <tr key={p.customer_package_id ?? i}
                          className={`group hover:bg-surface-container-low transition-colors ${i % 2 === 1 ? 'bg-surface-container-low/50' : ''}`}>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-on-surface shrink-0" style={{ background: bg }}>
                                {abbr}
                              </div>
                              <span className="font-semibold text-on-surface">{name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-on-surface-variant">{p.package_name || 'â€”'}</td>
                          <td className="py-4 px-4 text-right font-bold text-on-surface">
                            {p.price ? `à¸¿${Number(p.price).toLocaleString()}` : 'â€”'}
                          </td>
                          <td className="py-4 px-4 text-on-surface-variant">
                            {p.created_at ? (() => { const dt = new Date(p.created_at); return `${dt.getDate()} ${monthShort(dt.getMonth())} ${dt.getFullYear()}`; })() : 'â€”'}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.payment_status === 'refunded'
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {statusLabel(p.payment_status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {displayed.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button className="flex items-center gap-2 text-primary text-sm font-semibold hover:underline">
                {t('finances.loadMore')}
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

