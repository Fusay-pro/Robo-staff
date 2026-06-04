'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';

type SyncStatus = {
  synced_at:    string;
  triggered_by: string;
  rows_written: number;
} | null;

type DiffEntry = { field: string; old_value: string; new_value: string };
type DiffResult = {
  students:     { updated: ({ student_id: number } & DiffEntry)[] };
  packages:     { updated: ({ customer_package_id: number } & DiffEntry)[] };
  transactions: { added:   { date: string; student_name: string; package_name: string; amount: number; payment_method: string }[] };
} | null;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()} · ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function DataSyncPanel() {
  const { t } = useT();
  const [pushOk, setPushOk]         = useState(false);
  const [pushErr, setPushErr]       = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diff, setDiff]             = useState<DiffResult>(null);
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [importOk, setImportOk]     = useState(false);
  const [importErr, setImportErr]   = useState('');

  const { data: status, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ['sync-status'],
    queryFn:  () => client.get('/admin/sync/status').then(r => r.data),
  });

  const pushMut = useMutation({
    mutationFn: () => client.post('/admin/sync/push').then(r => r.data),
    onSuccess: () => { setPushOk(true); setPushErr(''); refetchStatus(); setTimeout(() => setPushOk(false), 4000); },
    onError:   (e: any) => setPushErr(e?.response?.data?.error || t('sync.syncError')),
  });

  const previewMut = useMutation({
    mutationFn: () => client.post('/admin/sync/pull/preview').then(r => r.data),
    onSuccess: (data) => { setDiff(data); setPreviewOpen(true); setImportOk(false); setImportErr(''); setPassword(''); },
    onError:   (e: any) => setPushErr(e?.response?.data?.error || t('sync.importError')),
  });

  const executeMut = useMutation({
    mutationFn: () => client.post('/admin/sync/pull/execute', { password, confirmed: true }).then(r => r.data),
    onSuccess: () => { setImportOk(true); setImportErr(''); setPassword(''); refetchStatus(); },
    onError:   (e: any) => setImportErr(e?.response?.data?.error || t('sync.importError')),
  });

  const totalChanges = diff
    ? diff.students.updated.length + diff.packages.updated.length + diff.transactions.added.length
    : 0;

  return (
    <div className="mt-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 overflow-hidden">
      {/* Push section */}
      <div className="p-6 border-b border-outline-variant/20">
        <div className="flex items-center justify-between mb-1">
          <h3 className="flex items-center gap-2 font-bold text-on-surface">
            <span className="material-symbols-outlined text-primary text-[20px]">cloud_sync</span>
            {t('sync.title')}
          </h3>
        </div>
        <p className="text-xs text-on-surface-variant mb-4">
          {status?.synced_at
            ? `${t('sync.lastSync')}: ${fmtDate(status.synced_at)} · ${status.triggered_by}`
            : t('sync.never')}
        </p>

        {pushOk && (
          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            {t('sync.syncSuccess')}
          </p>
        )}
        {pushErr && (
          <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mb-3">{pushErr}</p>
        )}

        <button
          onClick={() => { setPushOk(false); setPushErr(''); pushMut.mutate(); }}
          disabled={pushMut.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]">
            {pushMut.isPending ? 'sync' : 'upload_file'}
          </span>
          {pushMut.isPending ? t('sync.syncing') : t('sync.syncNow')}
        </button>
      </div>

      {/* Pull section */}
      <div className="p-6">
        <h4 className="font-bold text-on-surface text-sm mb-1">{t('sync.importTitle')}</h4>
        <p className="text-xs text-on-surface-variant mb-4">{t('sync.importHint')}</p>
        <button
          onClick={() => previewMut.mutate()}
          disabled={previewMut.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container disabled:opacity-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          {previewMut.isPending ? t('sync.previewing') : t('sync.previewImport')}
        </button>
      </div>

      {/* Preview modal */}
      {previewOpen && diff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPreviewOpen(false)} />
          <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">{t('sync.previewImport')}</h3>
              <button onClick={() => setPreviewOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

              {importOk ? (
                <div className="py-6 text-center">
                  <span className="material-symbols-outlined text-4xl text-emerald-500 block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <p className="font-semibold text-on-surface">{t('sync.importSuccess')}</p>
                </div>
              ) : totalChanges === 0 ? (
                <div className="py-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl block mb-2">check</span>
                  <p className="text-sm">{t('sync.noChanges')}</p>
                </div>
              ) : (
                <>
                  {/* Student changes */}
                  {diff.students.updated.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                        {t('sync.studentsUpdated')} ({diff.students.updated.length})
                      </p>
                      <div className="rounded-xl overflow-hidden border border-outline-variant/30">
                        <table className="w-full text-xs">
                          <thead className="bg-surface-container-low">
                            <tr>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">ID</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">{t('sync.field')}</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">{t('sync.oldValue')}</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">{t('sync.newValue')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.students.updated.map((r, i) => (
                              <tr key={i} className="border-t border-outline-variant/20">
                                <td className="px-3 py-2 text-on-surface-variant">{r.student_id}</td>
                                <td className="px-3 py-2 font-semibold text-on-surface">{r.field}</td>
                                <td className="px-3 py-2 text-error line-through">{r.old_value || '—'}</td>
                                <td className="px-3 py-2 text-emerald-700 font-semibold">{r.new_value || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Package changes */}
                  {diff.packages.updated.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-secondary mb-2">
                        {t('sync.packagesUpdated')} ({diff.packages.updated.length})
                      </p>
                      <div className="rounded-xl overflow-hidden border border-outline-variant/30">
                        <table className="w-full text-xs">
                          <thead className="bg-surface-container-low">
                            <tr>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">ID</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">{t('sync.field')}</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">{t('sync.oldValue')}</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">{t('sync.newValue')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.packages.updated.map((r, i) => (
                              <tr key={i} className="border-t border-outline-variant/20">
                                <td className="px-3 py-2 text-on-surface-variant">{r.customer_package_id}</td>
                                <td className="px-3 py-2 font-semibold text-on-surface">{r.field}</td>
                                <td className="px-3 py-2 text-error line-through">{r.old_value || '—'}</td>
                                <td className="px-3 py-2 text-emerald-700 font-semibold">{r.new_value || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* New transactions */}
                  {diff.transactions.added.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-tertiary mb-2">
                        {t('sync.transactionsAdded')} ({diff.transactions.added.length})
                      </p>
                      <div className="rounded-xl overflow-hidden border border-outline-variant/30">
                        <table className="w-full text-xs">
                          <thead className="bg-surface-container-low">
                            <tr>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">Date</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">Student</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">Package</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">Amount</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-semibold">Method</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.transactions.added.map((r, i) => (
                              <tr key={i} className="border-t border-outline-variant/20">
                                <td className="px-3 py-2 text-on-surface-variant">{r.date}</td>
                                <td className="px-3 py-2 font-semibold text-on-surface">{r.student_name}</td>
                                <td className="px-3 py-2 text-on-surface-variant">{r.package_name}</td>
                                <td className="px-3 py-2 text-on-surface">฿{Number(r.amount).toLocaleString()}</td>
                                <td className="px-3 py-2 text-on-surface-variant">{r.payment_method}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Password confirm */}
                  <div className="pt-2 border-t border-outline-variant/20">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {t('sync.passwordLabel')}
                    </label>
                    <p className="text-xs text-on-surface-variant mb-2">{t('sync.passwordHint')}</p>
                    <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="flex-1 bg-transparent py-2.5 text-sm text-on-surface outline-none"
                      />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                    {importErr && (
                      <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mt-2">{importErr}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!importOk && totalChanges > 0 && (
              <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 bg-surface">
                <button onClick={() => setPreviewOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => executeMut.mutate()}
                  disabled={!password || executeMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {executeMut.isPending ? t('sync.importing') : t('sync.confirmImport')}
                </button>
              </div>
            )}
            {(importOk || totalChanges === 0) && (
              <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface">
                <button onClick={() => setPreviewOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                  {t('common.close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
