'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DataSyncPanel from '@/components/DataSyncPanel';
import type { RobotType, Level } from './_types';

export default function SettingsTab() {
  const { role } = useAuth();
  const isOwner  = role === 'owner' || role === 'super_owner';
  const qc = useQueryClient();
  const { data: robotTypes = [] } = useQuery<RobotType[]>({ queryKey: ['robot-types'],   queryFn: () => client.get('/robot-types').then(r => r.data) });
  const { data: levels     = [] } = useQuery<Level[]>    ({ queryKey: ['course-levels'], queryFn: () => client.get('/course-levels').then(r => r.data) });

  const [rtModal, setRtModal] = useState<null | { editing?: any }>(null);
  const [rtForm, setRtForm]   = useState<{ name: string; quantity: string }>({ name: '', quantity: '8' });
  const [lvModal, setLvModal] = useState<null | { editing?: any }>(null);
  const [lvForm, setLvForm]   = useState<{ name: string }>({ name: '' });
  const [delTarget, setDelTarget] = useState<null | { kind: 'robot' | 'level'; id: number; name: string }>(null);
  const [threshold, setThreshold] = useState('3');
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const { data: branchSettings } = useQuery<any>({
    queryKey: ['branch-settings'],
    queryFn: () => client.get('/branches/settings').then(r => r.data),
  });

  useEffect(() => {
    if (branchSettings?.low_credit_threshold != null) {
      setThreshold(String(branchSettings.low_credit_threshold));
    }
  }, [branchSettings]);

  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' });
  const [branchSaved, setBranchSaved] = useState(false);
  const [branchErr, setBranchErr] = useState('');

  useEffect(() => {
    if (branchSettings?.name != null) {
      setBranchForm({
        name:    branchSettings.name || '',
        address: branchSettings.address || '',
        phone:   branchSettings.phone || '',
      });
    }
  }, [branchSettings]);

  const branchMut = useMutation({
    mutationFn: (d: any) => client.patch('/branches/settings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-settings'] });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      setBranchSaved(true);
      setTimeout(() => setBranchSaved(false), 1500);
    },
    onError: (e: any) => setBranchErr(e?.response?.data?.error || 'Failed to save'),
  });
  function saveBranch() {
    setBranchErr('');
    if (!branchForm.name.trim()) { setBranchErr('Name cannot be empty'); return; }
    branchMut.mutate({
      name:    branchForm.name.trim(),
      address: branchForm.address.trim() || undefined,
      phone:   branchForm.phone.trim() || undefined,
    });
  }

  const thresholdMut = useMutation({
    mutationFn: (v: number) => client.patch('/branches/settings', { low_credit_threshold: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-settings'] });
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 1500);
    },
  });

  function saveThreshold() {
    const n = parseInt(threshold);
    if (!isNaN(n) && n >= 1 && n <= 20 && n !== branchSettings?.low_credit_threshold) {
      thresholdMut.mutate(n);
    }
  }

  const rtMut = useMutation({
    mutationFn: (d: any) => d.robot_type_id
      ? client.patch(`/robot-types/${d.robot_type_id}`, { name: d.name, quantity: +d.quantity })
      : client.post('/robot-types', { name: d.name, quantity: +d.quantity }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['robot-types'] }); setRtModal(null); },
  });
  const lvMut = useMutation({
    mutationFn: (d: any) => d.level_id
      ? client.patch(`/course-levels/${d.level_id}`, { name: d.name })
      : client.post('/course-levels', { name: d.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-levels'] }); setLvModal(null); },
  });
  const delRt = useMutation({
    mutationFn: (id: number) => client.delete(`/robot-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['robot-types'] }); setDelTarget(null); },
  });
  const delLv = useMutation({
    mutationFn: (id: number) => client.delete(`/course-levels/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-levels'] }); setDelTarget(null); },
  });

  function openRt(rt?: any) {
    setRtForm(rt ? { name: rt.name, quantity: String(rt.quantity) } : { name: '', quantity: '8' });
    setRtModal({ editing: rt });
  }
  function openLv(lv?: any) {
    setLvForm(lv ? { name: lv.name } : { name: '' });
    setLvModal({ editing: lv });
  }

  return (
    <>
      {/* Branch info */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-primary/5">
          <div>
            <h3 className="font-bold text-on-surface">Branch Info</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">What parents see on their app — name, address, phone</p>
          </div>
          <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Branch Name <span className="text-error">*</span></label>
            <input value={branchForm.name}
              onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Phetkasem 69"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Address</label>
            <input value={branchForm.address}
              onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. 123 Soi Petchkasem 69, Bangkok"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Phone</label>
            <input type="tel" value={branchForm.phone}
              onChange={e => setBranchForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. 02-123-4567"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
            <button onClick={saveBranch} disabled={branchMut.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
              <span className="material-symbols-outlined text-[16px]">save</span>
              {branchMut.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            {branchSaved && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved
              </span>
            )}
            {branchErr && <span className="text-xs text-error">{branchErr}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Robot Types */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-primary/5">
            <div>
              <h3 className="font-bold text-on-surface">Robot Types</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Used as default capacity per session</p>
            </div>
            <button onClick={() => openRt()}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">
              <span className="material-symbols-outlined text-[14px]">add</span> Add
            </button>
          </div>
          {robotTypes.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">No robot types yet.</div>
          ) : (
            <div className="divide-y divide-outline-variant/15">
              {robotTypes.map((rt: any) => (
                <div key={rt.robot_type_id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{rt.name}</p>
                    <p className="text-[11px] text-on-surface-variant">Qty: {rt.quantity}</p>
                  </div>
                  <button onClick={() => openRt(rt)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button onClick={() => setDelTarget({ kind: 'robot', id: rt.robot_type_id, name: rt.name })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course Levels */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-primary/5">
            <div>
              <h3 className="font-bold text-on-surface">Course Levels</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Tag courses by skill level (Beginner, Intermediate, …)</p>
            </div>
            <button onClick={() => openLv()}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">
              <span className="material-symbols-outlined text-[14px]">add</span> Add
            </button>
          </div>
          {levels.length === 0 ? (
            <div className="py-10 text-center text-sm text-on-surface-variant">No levels yet.</div>
          ) : (
            <div className="divide-y divide-outline-variant/15">
              {levels.map((lv: any) => (
                <div key={lv.level_id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>stairs</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface text-sm">{lv.name}</p>
                  </div>
                  <button onClick={() => openLv(lv)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button onClick={() => setDelTarget({ kind: 'level', id: lv.level_id, name: lv.name })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low-Credit Alert */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/20 bg-primary/5">
            <h3 className="font-bold text-on-surface">Low-Credit Alert</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Auto-notify parents when a child's classes fall below this threshold.</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-on-surface">Alert when below</span>
              <input type="number" min="1" max="20" value={threshold}
                onChange={e => setThreshold(e.target.value)}
                onBlur={saveThreshold}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-20 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <span className="text-sm text-on-surface-variant">classes</span>
              {thresholdMut.isPending && (
                <span className="text-xs text-on-surface-variant flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              )}
              {thresholdSaved && !thresholdMut.isPending && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Saved
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3">
              Parents get a daily notification when their child has this many classes left or fewer.
            </p>
          </div>
        </div>
      </div>

      {/* Robot Type modal */}
      {rtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRtModal(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{rtModal.editing ? 'Edit Robot Type' : 'New Robot Type'}</h3>
              <button onClick={() => setRtModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Name</label>
                <input value={rtForm.name} onChange={e => setRtForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. LEGO SPIKE"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Quantity</label>
                <input type="number" min="1" value={rtForm.quantity} onChange={e => setRtForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <p className="text-[11px] text-on-surface-variant mt-1">Default max capacity for sessions using this robot.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRtModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button
                onClick={() => rtMut.mutate({ ...rtForm, robot_type_id: rtModal.editing?.robot_type_id })}
                disabled={!rtForm.name.trim() || rtMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {rtMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level modal */}
      {lvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLvModal(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{lvModal.editing ? 'Edit Level' : 'New Level'}</h3>
              <button onClick={() => setLvModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Name</label>
              <input value={lvForm.name} onChange={e => setLvForm({ name: e.target.value })}
                placeholder="e.g. Beginner"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setLvModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button
                onClick={() => lvMut.mutate({ ...lvForm, level_id: lvModal.editing?.level_id })}
                disabled={!lvForm.name.trim() || lvMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {lvMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
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
            <h3 className="text-lg font-bold text-on-surface mb-1">Delete {delTarget.kind === 'robot' ? 'Robot Type' : 'Level'}?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-semibold">{delTarget.name}</span> will be removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button
                onClick={() => delTarget.kind === 'robot' ? delRt.mutate(delTarget.id) : delLv.mutate(delTarget.id)}
                disabled={delRt.isPending || delLv.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {(delRt.isPending || delLv.isPending) ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && <DataSyncPanel />}
    </>
  );
}
