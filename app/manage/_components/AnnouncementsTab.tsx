'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import type { Announcement } from './_types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
function resolveImg(u: string) {
  if (!u) return '';
  return u.startsWith('http') ? u : `${API_URL}${u}`;
}

export default function AnnouncementsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', body: '', image_url: '' });
  const [sendErr, setSendErr] = useState('');
  const [sendOk,  setSendOk]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [delTarget, setDelTarget] = useState<Announcement | null>(null);
  const [viewsTarget, setViewsTarget] = useState<Announcement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: viewsData, isLoading: viewsLoading } = useQuery<any>({
    queryKey: ['announcement-views', viewsTarget?.announcement_id],
    queryFn: () => client.get(`/announcements/${viewsTarget!.announcement_id}/views`).then(r => r.data),
    enabled: !!viewsTarget,
  });

  const { data: history = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn:  () => client.get('/announcements').then(r => r.data),
  });

  const sendMut = useMutation({
    mutationFn: (d: any) => client.post('/announcements', d).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setForm({ title: '', body: '', image_url: '' });
      setSendOk(true);
      setTimeout(() => setSendOk(false), 3000);
    },
    onError: (e: any) => setSendErr(e.response?.data?.error || 'Failed to send'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => client.delete(`/announcements/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['announcements'] }); setDelTarget(null); },
  });

  async function handleFile(file: File) {
    setSendErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await client.post('/announcements/upload-image', fd);
      setForm(f => ({ ...f, image_url: data.url }));
    } catch (e: any) {
      setSendErr(e?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function send() {
    if (!form.title.trim()) return;
    setSendErr('');
    sendMut.mutate({ title: form.title, body: form.body || undefined, image_url: form.image_url || undefined, send_to: 'all' });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Sent history */}
      <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10">
          <h3 className="font-bold text-on-surface">Sent</h3>
        </div>
        {history.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl block mb-2">campaign</span>
            <p className="text-sm">No announcements yet</p>
          </div>
        ) : (
          <div className="p-3 space-y-2 max-h-[520px] overflow-y-auto">
            {history.map(a => (
              <div key={a.announcement_id} className="p-3.5 rounded-2xl bg-surface-container-low">
                <div className="flex items-start gap-3">
                  {a.image_url && (
                    <img src={resolveImg(a.image_url)} alt=""
                      onError={e => (e.currentTarget.style.display = 'none')}
                      className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm leading-tight">{a.title}</p>
                    {a.body && <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{a.body}</p>}
                    <p className="text-[10px] text-on-surface-variant mt-1.5">
                      {new Date(a.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => setViewsTarget(a)}
                      title="Who has seen this"
                      className="w-7 h-7 flex items-center justify-center hover:bg-primary/10 text-on-surface-variant hover:text-primary rounded-lg transition-all">
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                    <button onClick={() => setDelTarget(a)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-error/10 text-on-surface-variant hover:text-error rounded-lg transition-all">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-surface-container-lowest rounded-3xl p-5">
          <h3 className="font-bold text-on-surface mb-4">New Announcement</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. School closure this Friday"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Message</label>
              <textarea rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Additional details…"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Image <span className="normal-case font-normal tracking-normal">(optional)</span></label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              {form.image_url ? (
                <div className="relative rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/30">
                  <img src={resolveImg(form.image_url)} alt=""
                    onError={e => (e.currentTarget.style.display = 'none')}
                    className="w-full h-40 object-cover" />
                  <button
                    onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                    title="Remove image">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-outline-variant/40 bg-surface-container-low hover:bg-surface-container hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-1.5 disabled:opacity-50">
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-on-surface-variant font-semibold">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">add_photo_alternate</span>
                      <span className="text-sm font-semibold text-on-surface">Choose image from PC</span>
                      <span className="text-[10px] text-on-surface-variant">PNG / JPG, max 5 MB</span>
                    </>
                  )}
                </button>
              )}

              <details className="mt-2">
                <summary className="text-[11px] text-on-surface-variant cursor-pointer hover:text-on-surface">Or paste a URL</summary>
                <input value={form.image_url.startsWith('http') ? form.image_url : ''}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full mt-2 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </details>
            </div>
            {sendErr && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{sendErr}</p>}
            {sendOk  && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">Announcement sent to all parents!</p>}
            <button onClick={send} disabled={!form.title.trim() || sendMut.isPending}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">send</span>
              {sendMut.isPending ? 'Sending…' : 'Send to All'}
            </button>
          </div>
        </div>
      </div>

      {/* View receipts modal */}
      {viewsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewsTarget(null)} />
          <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Read receipts</p>
                <h3 className="text-lg font-bold text-on-surface leading-tight truncate">{viewsTarget.title}</h3>
              </div>
              <button onClick={() => setViewsTarget(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            {viewsLoading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : viewsData ? (
              <>
                <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total</p>
                    <p className="text-2xl font-extrabold text-on-surface">{viewsData.total}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Seen</p>
                    <p className="text-2xl font-extrabold text-emerald-700">{viewsData.seen_count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Unseen</p>
                    <p className="text-2xl font-extrabold text-orange-700">{viewsData.unseen_count}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {viewsData.unseen_count > 0 && (
                    <>
                      <div className="px-6 py-2 bg-orange-50 border-b border-orange-100 sticky top-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                          Haven&apos;t seen ({viewsData.unseen_count})
                        </p>
                      </div>
                      {viewsData.unseen.map((p: any) => (
                        <div key={p.user_id} className="px-6 py-3 flex items-center gap-3 border-b border-outline-variant/15">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                            <span className="text-orange-700 text-xs font-bold">{p.name?.[0]?.toUpperCase() ?? '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-on-surface text-sm truncate">{p.name}</p>
                            {p.phone && <p className="text-xs text-on-surface-variant">{p.phone}</p>}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {viewsData.seen_count > 0 && (
                    <>
                      <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-100 sticky top-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Seen ({viewsData.seen_count})
                        </p>
                      </div>
                      {viewsData.seen.map((p: any) => (
                        <div key={p.user_id} className="px-6 py-3 flex items-center gap-3 border-b border-outline-variant/15">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-emerald-700 text-[14px]">check</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-on-surface text-sm truncate">{p.name}</p>
                            <p className="text-[11px] text-on-surface-variant">
                              {new Date(p.viewed_at).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {viewsData.total === 0 && (
                    <div className="py-10 text-center text-on-surface-variant text-sm">
                      No parents on file for this branch yet.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">delete</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">Delete announcement?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-semibold">{delTarget.title}</span> will be removed.
              {delTarget.image_url?.startsWith('/uploads/') && ' The attached image will also be deleted.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={() => delMut.mutate(delTarget.announcement_id)} disabled={delMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {delMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
