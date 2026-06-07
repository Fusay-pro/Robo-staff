'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useT } from '@/context/I18nContext';
import ImportPreviewModal, { DiffResult } from './sync/ImportPreviewModal';

type SyncStatus = {
  synced_at:    string;
  triggered_by: string;
  rows_written: number;
} | null;

type SheetUrls = {
  sheets_operational_id: string | null;
  sheets_finance_id:     string | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()} · ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`;
}

function SheetUrlField({ label, value }: { label: string; value: string | null }) {
  const { t } = useT();
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-xs text-on-surface truncate font-mono">
        {value || <span className="text-on-surface-variant italic">{t('sync.notSet')}</span>}
      </p>
    </div>
  );
}

function EditSheetsModal({ current, onClose, onSaved }: {
  current: SheetUrls;
  onClose: () => void;
  onSaved: (data: SheetUrls) => void;
}) {
  const { t } = useT();
  const [operationalUrl, setOperationalUrl] = useState(current.sheets_operational_id ?? '');
  const [financeUrl, setFinanceUrl]         = useState(current.sheets_finance_id ?? '');
  const [password, setPassword]             = useState('');
  const [showPass, setShowPass]             = useState(false);
  const [err, setErr]                       = useState('');

  const mut = useMutation({
    mutationFn: () => client.patch('/admin/sync/sheets', {
      sheets_operational_id: operationalUrl.trim() || null,
      sheets_finance_id:     financeUrl.trim()     || null,
      password,
    }).then(r => r.data),
    onSuccess: (data) => { onSaved(data); onClose(); },
    onError:   (e: any) => setErr(e?.response?.data?.error || t('sync.saveError')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-md">
        <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface">{t('sync.editSheets')}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{t('sync.editSheetsHint')}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              {t('sync.operationalSheet')}
            </label>
            <input value={operationalUrl} onChange={e => setOperationalUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              {t('sync.financeSheet')}
            </label>
            <input value={financeUrl} onChange={e => setFinanceUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              {t('sync.confirmPassword')}
            </label>
            <p className="text-xs text-on-surface-variant mb-2">{t('sync.passwordHint')}</p>
            <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 bg-transparent py-2.5 text-sm text-on-surface outline-none" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={() => mut.mutate()} disabled={!password || mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DataSyncPanel() {
  const { t } = useT();
  const qc = useQueryClient();
  const [pushOk, setPushOk]         = useState(false);
  const [pushErr, setPushErr]       = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diff, setDiff]             = useState<DiffResult>(null);
  const [editSheets, setEditSheets] = useState(false);

  const { data: status, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ['sync-status'],
    queryFn:  () => client.get('/admin/sync/status').then(r => r.data),
  });

  const { data: sheetUrls, refetch: refetchSheets } = useQuery<SheetUrls>({
    queryKey: ['sync-sheets'],
    queryFn:  () => client.get('/admin/sync/sheets').then(r => r.data),
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

      {/* Sheet URL settings */}
      <div className="p-6 border-t border-outline-variant/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-on-surface text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">link</span>
            {t('sync.sheetLinks')}
          </h4>
          <button onClick={() => setEditSheets(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[14px]">edit</span>
            {t('common.edit')}
          </button>
        </div>
        <div className="space-y-2">
          <SheetUrlField label={t('sync.operationalSheet')} value={sheetUrls?.sheets_operational_id ?? null} />
          <SheetUrlField label={t('sync.financeSheet')}     value={sheetUrls?.sheets_finance_id     ?? null} />
        </div>
      </div>

      <ImportPreviewModal
        open={previewOpen}
        diff={diff}
        onClose={() => setPreviewOpen(false)}
        onImportSuccess={() => refetchStatus()}
      />

      {editSheets && sheetUrls !== undefined && (
        <EditSheetsModal
          current={sheetUrls ?? { sheets_operational_id: null, sheets_finance_id: null }}
          onClose={() => setEditSheets(false)}
          onSaved={(data) => { qc.setQueryData(['sync-sheets'], data); }}
        />
      )}
    </div>
  );
}
