'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';
import ImportPreviewModal, { DiffResult } from './sync/ImportPreviewModal';

type SyncStatus = {
  synced_at:    string;
  triggered_by: string;
  rows_written: number;
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
    onSuccess: (data) => { setDiff(data); setPreviewOpen(true); },
    onError:   (e: any) => setPushErr(e?.response?.data?.error || t('sync.importError')),
  });

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

      <ImportPreviewModal
        open={previewOpen}
        diff={diff}
        onClose={() => setPreviewOpen(false)}
        onImportSuccess={() => refetchStatus()}
      />
    </div>
  );
}
