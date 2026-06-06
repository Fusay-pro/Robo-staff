'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';
import type { StaffUser } from './_types';

function StaffCard({ user, onEdit, onDelete }: { user: StaffUser; onEdit: (u: StaffUser) => void; onDelete: (u: StaffUser) => void }) {
  const initials = user.name?.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  const isOwner = user.role === 'owner' || user.role === 'super_owner';
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-sm truncate">{user.name}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{user.email}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase ${
          isOwner ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
        }`}>
          {user.role}
        </span>
      </div>
      <div className="text-[11px] text-on-surface-variant grid grid-cols-2 gap-1">
        {user.phone && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">call</span>{user.phone}</span>}
        {user.monthly_salary != null && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">payments</span>฿{user.monthly_salary.toLocaleString?.()}</span>}
      </div>
      <div className="flex gap-2 mt-1">
        <button onClick={() => onEdit(user)}
          className="flex-1 py-1.5 rounded-lg bg-surface-container text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[14px]">edit</span> Edit
        </button>
        <button onClick={() => onDelete(user)}
          className="px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs font-bold hover:bg-error/15 transition-colors">
          <span className="material-symbols-outlined text-[14px]">person_remove</span>
        </button>
      </div>
    </div>
  );
}

export default function StaffTab() {
  const qc = useQueryClient();

  const { data: list, isLoading } = useQuery<{ data: StaffUser[]; total: number }>({
    queryKey: ['staff-users'],
    queryFn: () => client.get('/users?limit=200').then(r => r.data),
  });
  const users = list?.data ?? [];

  const [modal, setModal] = useState<null | { editing?: StaffUser }>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'staff' as 'staff' | 'owner',
    monthly_salary: '',
  });
  const [err, setErr] = useState('');
  const [delTarget, setDelTarget] = useState<StaffUser | null>(null);

  const createMut = useMutation({
    mutationFn: (d: any) => client.post('/users', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-users'] }); setModal(null); },
    onError: (e: any) => setErr(e?.response?.data?.error || 'Failed to create'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: any) => client.patch(`/users/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-users'] }); setModal(null); },
    onError: (e: any) => setErr(e?.response?.data?.error || 'Failed to save'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => client.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-users'] }); setDelTarget(null); },
  });

  function openCreate() {
    setForm({ name: '', email: '', phone: '', password: '', role: 'staff', monthly_salary: '' });
    setErr('');
    setModal({});
  }
  function openEdit(u: StaffUser) {
    setForm({
      name:           u.name,
      email:          u.email,
      phone:          u.phone || '',
      password:       '',
      role:           (u.role === 'owner' ? 'owner' : 'staff'),
      monthly_salary: u.monthly_salary != null ? String(u.monthly_salary) : '',
    });
    setErr('');
    setModal({ editing: u });
  }

  function save() {
    setErr('');
    if (!form.name.trim())  { setErr('Name is required'); return; }
    if (modal?.editing) {
      updateMut.mutate({
        id: modal.editing.user_id,
        body: {
          name:           form.name.trim(),
          phone:          form.phone.trim() || undefined,
          monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : undefined,
        },
      });
    } else {
      if (!form.email.trim() || form.password.length < 8) { setErr('Email + password (min 8) required'); return; }
      createMut.mutate({
        name:           form.name.trim(),
        email:          form.email.trim(),
        password:       form.password,
        phone:          form.phone.trim() || undefined,
        role:           form.role,
        monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : undefined,
      });
    }
  }

  const owners = users.filter(u => u.role === 'owner' || u.role === 'super_owner');
  const staff  = users.filter(u => u.role === 'staff');

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">
          {users.length} account{users.length !== 1 ? 's' : ''} at this branch
        </p>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[16px]">person_add</span> Add Staff
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-surface-container-low animate-pulse rounded-2xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2">group</span>
          <p className="font-semibold text-on-surface">No staff yet</p>
          <p className="text-xs mt-1">Add teachers so they can mark attendance on the Today page.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {owners.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Owners</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {owners.map(u => <StaffCard key={u.user_id} user={u} onEdit={openEdit} onDelete={setDelTarget} />)}
              </div>
            </div>
          )}
          {staff.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Teachers / Staff</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {staff.map(u => <StaffCard key={u.user_id} user={u} onEdit={openEdit} onDelete={setDelTarget} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-md shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{modal.editing ? 'Edit Staff' : 'New Staff'}</h3>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Name <span className="text-error">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kru Pim"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Email {!modal.editing && <span className="text-error">*</span>}
                </label>
                <input type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="staff@example.com"
                  disabled={!!modal.editing}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="081-234-5678"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Salary (THB/mo)</label>
                  <input type="number" min="0" value={form.monthly_salary}
                    onChange={e => setForm(f => ({ ...f, monthly_salary: e.target.value }))}
                    placeholder="25000"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              {!modal.editing && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['staff','owner'] as const).map(r => (
                        <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                            form.role === r ? 'bg-primary text-white border-primary' : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:border-primary/40'
                          }`}>
                          {r === 'staff' ? 'Teacher (Staff)' : 'Co-Owner'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-1.5">
                      Co-owners can create other staff & edit branch info. Teachers can only mark attendance.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Initial Password <span className="text-error">*</span></label>
                    <input type="password" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min 8 characters"
                      minLength={8}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <p className="text-[11px] text-on-surface-variant mt-1.5">Share this with them — they can change it later via Settings.</p>
                  </div>
                </>
              )}

              {err && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{err}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={createMut.isPending || updateMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {createMut.isPending || updateMut.isPending ? 'Saving…' : modal.editing ? 'Save Changes' : 'Create Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-2xl">person_remove</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">Remove staff?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              <span className="font-semibold text-on-surface">{delTarget.name}</span> will lose access. Their attendance history stays intact.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteMut.mutate(delTarget.user_id)} disabled={deleteMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {deleteMut.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
