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

function CollapsibleSection({ icon, title, subtitle, defaultOpen = false, danger = false, open: controlledOpen, onOpenChange, children }: {
  icon: string; title: string; subtitle: string; defaultOpen?: boolean; danger?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className={`border-t border-outline-variant/20 first:border-t-0 ${danger ? 'bg-error/5' : ''}`}>
      <button onClick={toggle}
        className="w-full flex items-center justify-between gap-3 p-6 text-left hover:bg-surface-container/40 transition-colors">
        <div className="min-w-0">
          <h4 className={`flex items-center gap-2 font-bold text-sm ${danger ? 'text-error' : 'text-on-surface'}`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            {title}
          </h4>
          <p className="text-xs text-on-surface-variant mt-1 truncate">{subtitle}</p>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

function PasswordField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="mb-3">
      <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('sync.passwordLabel')}</label>
      <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <input type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          className="flex-1 bg-transparent py-2.5 text-sm text-on-surface outline-none" />
        <button type="button" onClick={() => setShow(v => !v)} className="text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[18px]">{show ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
      {error && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mt-2">{error}</p>}
    </div>
  );
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

type ImportResult = { imported: number; skipped: number; parents?: number; sheetUpdated?: boolean; errors: string[] } | null;

function ResetModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr]           = useState('');

  const mut = useMutation({
    mutationFn: () => client.post('/admin/sync/reset', { password, confirmed: true }).then(r => r.data),
    onSuccess: () => { onDone(); onClose(); },
    onError:   (e: any) => setErr(e?.response?.data?.error || t('sync.resetError')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-sm">
        <div className="px-6 pt-5 pb-3 border-b border-error/20">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-error text-[20px]">warning</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface">{t('sync.resetTitle')}</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">{t('sync.resetWarning')}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('sync.confirmPassword')}</label>
            <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 focus-within:border-error focus-within:ring-2 focus-within:ring-error/20 transition-all">
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 bg-transparent py-2.5 text-sm text-on-surface outline-none" />
              <button type="button" onClick={() => setShowPass(v => !v)} className="text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={() => mut.mutate()} disabled={!password || mut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mut.isPending ? t('sync.resetting') : t('sync.resetConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

type RowsWritten = Record<string, number>;

function PushModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [rowsWritten, setRowsWritten] = useState<RowsWritten | null>(null);

  const mut = useMutation({
    mutationFn: () => client.post('/admin/sync/push', { password, confirmed: true }).then(r => r.data),
    onSuccess: (data) => { setRowsWritten(data.rows_written); setErr(''); onDone(); },
    onError:   (e: any) => setErr(e?.response?.data?.error || t('sync.syncError')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-sm">
        <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20">
          <h3 className="text-lg font-bold text-on-surface">{t('sync.syncNow')}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{t('sync.syncNowHint')}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {rowsWritten ? (
            <div className="py-2 text-center">
              <span className="material-symbols-outlined text-4xl text-emerald-500 block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="font-semibold text-on-surface">{t('sync.syncSuccess')}</p>
              <div className="mt-3 text-xs text-on-surface-variant space-y-0.5">
                {Object.entries(rowsWritten).map(([k, v]) => (
                  <p key={k}>{k}: <span className="font-semibold text-on-surface">{v}</span></p>
                ))}
              </div>
            </div>
          ) : (
            <PasswordField value={password} onChange={setPassword} error={err} />
          )}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          {rowsWritten ? (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              {t('common.close')}
            </button>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => mut.mutate()} disabled={!password || mut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {mut.isPending ? t('sync.syncing') : t('sync.syncNow')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportStudentsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { t } = useT();
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [result, setResult]     = useState<ImportResult>(null);

  const mut = useMutation({
    mutationFn: () => client.post('/admin/sync/import-students', { password, confirmed: true }).then(r => r.data),
    onSuccess: (data) => { setResult(data); setErr(''); onImported(); },
    onError:   (e: any) => setErr(e?.response?.data?.error || t('sync.importError')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-sm">
        <div className="px-6 pt-5 pb-3 border-b border-outline-variant/20">
          <h3 className="text-lg font-bold text-on-surface">{t('sync.importStudents')}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{t('sync.importStudentsHint')}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {result ? (
            <div className={`rounded-xl px-3 py-2.5 text-xs space-y-0.5 ${result.errors.length ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className="font-bold text-on-surface">
                {t('sync.importStudentsSuccess', { count: result.imported })}
              </p>
              {result.skipped > 0 && (
                <p className="text-on-surface-variant">Skipped {result.skipped} duplicates</p>
              )}
              {typeof result.parents === 'number' && result.parents > 0 && (
                <p className="text-on-surface-variant">Created {result.parents} parent accounts (RCP codes)</p>
              )}
              {result.sheetUpdated && (
                <p className="text-on-surface-variant">✓ Wrote parent codes back to the sheet</p>
              )}
              {result.errors.map((e, i) => (
                <p key={i} className="text-error">{e}</p>
              ))}
            </div>
          ) : (
            <PasswordField value={password} onChange={setPassword} error={err} />
          )}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          {result ? (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              {t('common.close')}
            </button>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => mut.mutate()} disabled={!password || mut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {mut.isPending ? t('sync.importing') : t('sync.importStudents')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DataSyncPanel() {
  const { t } = useT();
  const qc = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diff, setDiff]             = useState<DiffResult>(null);
  const [previewErr, setPreviewErr] = useState('');
  const [showReset, setShowReset]   = useState(false);
  const [showPush, setShowPush]     = useState(false);
  const [showImportStudents, setShowImportStudents] = useState(false);

  // Sheet Links: not fetched until the user re-confirms their password —
  // collapsing the section forgets it again, so re-expanding always re-asks.
  const [sheetsOpen, setSheetsOpen]         = useState(false);
  const [sheetUrls, setSheetUrls]           = useState<SheetUrls | null>(null);
  const [revealPassword, setRevealPassword] = useState('');
  const [revealErr, setRevealErr]           = useState('');
  const [editSheets, setEditSheets]         = useState(false);

  const { data: status, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ['sync-status'],
    queryFn:  () => client.get('/admin/sync/status').then(r => r.data),
  });
  const hasSyncedBefore = !!status?.synced_at;

  const previewMut = useMutation({
    mutationFn: () => client.post('/admin/sync/pull/preview').then(r => r.data),
    onSuccess: (data) => { setDiff(data); setPreviewOpen(true); setPreviewErr(''); },
    onError:   (e: any) => setPreviewErr(e?.response?.data?.error || t('sync.importError')),
  });

  const revealMut = useMutation({
    mutationFn: () => client.post('/admin/sync/sheets/reveal', { password: revealPassword, confirmed: true }).then(r => r.data),
    onSuccess: (data) => { setSheetUrls(data); setRevealErr(''); setRevealPassword(''); },
    onError:   (e: any) => setRevealErr(e?.response?.data?.error || t('sync.saveError')),
  });

  return (
    <div className="mt-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 overflow-hidden">
      {/* Push section */}
      <CollapsibleSection icon="cloud_sync" title={t('sync.title')}
        subtitle={status?.synced_at ? `${t('sync.lastSync')}: ${fmtDate(status.synced_at)} · ${status.triggered_by}` : t('sync.never')}>
        <p className="text-xs text-on-surface-variant mb-4">{t('sync.syncNowHint')}</p>
        <button
          onClick={() => setShowPush(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]">upload_file</span>
          {t('sync.syncNow')}
        </button>
      </CollapsibleSection>

      {/* Pull section */}
      <CollapsibleSection icon="download" title={t('sync.importTitle')} subtitle={t('sync.importHint')}>
        {!hasSyncedBefore && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-start gap-1.5">
            <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
            {t('sync.syncFirstHint')}
          </p>
        )}
        {previewErr && (
          <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2 mb-3">{previewErr}</p>
        )}
        <button
          onClick={() => previewMut.mutate()}
          disabled={previewMut.isPending || !hasSyncedBefore}
          title={!hasSyncedBefore ? t('sync.syncFirstHint') : undefined}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container disabled:opacity-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          {previewMut.isPending ? t('sync.previewing') : t('sync.previewImport')}
        </button>
      </CollapsibleSection>

      {/* Import students from registration sheet */}
      <CollapsibleSection icon="person_add" title={t('sync.importStudents')} subtitle={t('sync.importStudentsHint')}>
        <button
          onClick={() => setShowImportStudents(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          {t('sync.importStudents')}
        </button>
      </CollapsibleSection>

      {/* Sheet URL links — password-gated reveal */}
      <CollapsibleSection icon="link" title={t('sync.sheetLinks')} subtitle={t('sync.sheetLinksHint')}
        open={sheetsOpen}
        onOpenChange={(next) => {
          setSheetsOpen(next);
          if (!next) { setSheetUrls(null); setRevealPassword(''); setRevealErr(''); }
        }}>
        {sheetUrls ? (
          <>
            <div className="flex items-center justify-end mb-3">
              <button onClick={() => setEditSheets(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[14px]">edit</span>
                {t('common.edit')}
              </button>
            </div>
            <div className="space-y-2">
              <SheetUrlField label={t('sync.operationalSheet')} value={sheetUrls.sheets_operational_id} />
              <SheetUrlField label={t('sync.financeSheet')}     value={sheetUrls.sheets_finance_id} />
            </div>
          </>
        ) : (
          <>
            <PasswordField value={revealPassword} onChange={setRevealPassword} error={revealErr} />
            <button
              onClick={() => revealMut.mutate()}
              disabled={!revealPassword || revealMut.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              {revealMut.isPending ? t('common.loading') : t('sync.viewLinks')}
            </button>
          </>
        )}
      </CollapsibleSection>

      {/* Danger zone */}
      <div className="p-6 border-t border-error/20 bg-error/5">
        <h4 className="font-bold text-error text-sm mb-1 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">dangerous</span>
          {t('sync.resetTitle')}
        </h4>
        <p className="text-xs text-on-surface-variant mb-4">{t('sync.resetHint')}</p>
        <button onClick={() => setShowReset(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-error/40 text-sm font-bold text-error hover:bg-error/10 transition-colors">
          <span className="material-symbols-outlined text-[16px]">delete_forever</span>
          {t('sync.resetConfirm')}
        </button>
      </div>

      <ImportPreviewModal
        open={previewOpen}
        diff={diff}
        onClose={() => setPreviewOpen(false)}
        onImportSuccess={() => refetchStatus()}
      />

      {showPush && (
        <PushModal
          onClose={() => setShowPush(false)}
          onDone={() => refetchStatus()}
        />
      )}

      {showImportStudents && (
        <ImportStudentsModal
          onClose={() => setShowImportStudents(false)}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ['students-list'] });
            qc.invalidateQueries({ queryKey: ['students-stats'] });
          }}
        />
      )}

      {showReset && (
        <ResetModal
          onClose={() => setShowReset(false)}
          onDone={() => qc.invalidateQueries()}
        />
      )}

      {editSheets && sheetUrls && (
        <EditSheetsModal
          current={sheetUrls}
          onClose={() => setEditSheets(false)}
          onSaved={(data) => setSheetUrls(data)}
        />
      )}
    </div>
  );
}
