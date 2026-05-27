'use client';

import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import LanguageToggle from '@/components/LanguageToggle';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import client from '@/lib/api';

export default function SettingsPage() {
  const { role, signOut } = useAuth();
  const { t } = useT();
  const [pushNotif, setPushNotif] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileErr, setProfileErr] = useState('');

  const { data: profile } = useQuery<any>({
    queryKey: ['my-profile'],
    queryFn: () => client.get('/my/profile').then(r => r.data),
  });

  const profileMut = useMutation({
    mutationFn: (d: any) => client.patch('/my/profile', d).then(r => r.data),
    onSuccess: () => setProfileModal(false),
    onError: (e: any) => setProfileErr(e.response?.data?.error || t('settings.failedSave')),
  });

  // Change password
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwOk, setPwOk]   = useState(false);
  const [showPw, setShowPw] = useState(false);

  const pwMut = useMutation({
    mutationFn: (d: any) => client.patch('/users/me/password', d),
    onSuccess: () => {
      setPwOk(true);
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwOk(false), 3000);
    },
    onError: (e: any) => setPwErr(e?.response?.data?.error || t('settings.failedPw')),
  });

  function submitPassword() {
    setPwErr('');
    if (!pwForm.current) { setPwErr(t('settings.enterCurrentPw')); return; }
    if (pwForm.next.length < 8) { setPwErr(t('settings.pwShort')); return; }
    if (pwForm.next !== pwForm.confirm) { setPwErr(t('settings.pwMismatch')); return; }
    pwMut.mutate({ current_password: pwForm.current, new_password: pwForm.next });
  }

  const isOwner = role === 'owner' || role === 'super_owner';
  const roleLabel = isOwner ? t('nav.ownerAccess') : t('nav.staffAccess');

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-10 md:py-8 pb-24 md:pb-8 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-on-surface">{t('settings.title')}</h2>
          <p className="text-on-surface-variant mt-1 text-sm">{t('settings.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: Account card */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile card */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="bg-primary/5 px-6 py-4 border-b border-outline-variant/20">
                <p className="text-[11px] font-bold tracking-widest text-primary uppercase">{t('settings.account')}</p>
              </div>
              <div className="p-6 flex flex-col items-center text-center gap-3">
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-[38px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                </div>
                <div>
                  <p className="font-bold text-on-surface text-lg">{profile?.name || (isOwner ? t('settings.owner') : t('settings.staffMember'))}</p>
                  {profile?.phone && <p className="text-sm text-on-surface-variant">{profile.phone}</p>}
                  <span className="inline-block mt-2 text-[10px] font-bold tracking-wider px-3 py-1 rounded-full bg-primary/10 text-primary uppercase">
                    {roleLabel}
                  </span>
                </div>
                <button
                  onClick={() => { setProfileForm({ name: profile?.name || '', phone: profile?.phone || '' }); setProfileErr(''); setProfileModal(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity mt-1"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  {t('settings.editProfile')}
                </button>
              </div>
            </div>

          </div>

          {/* Right column: Settings panels */}
          <div className="lg:col-span-2 space-y-6">

            {/* Notifications */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="bg-primary/5 px-6 py-4 border-b border-outline-variant/20">
                <p className="text-[11px] font-bold tracking-widest text-primary uppercase">{t('settings.notifications')}</p>
              </div>
              <div className="divide-y divide-outline-variant/20">
                <div className="flex items-center gap-4 px-6 py-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">notifications_active</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">{t('settings.pushNotifications')}</p>
                    <p className="text-xs text-on-surface-variant">{t('settings.pushHint')}</p>
                  </div>
                  <button onClick={() => setPushNotif(v => !v)}
                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${pushNotif ? 'bg-primary' : 'bg-outline-variant'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushNotif ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-4 px-6 py-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">mail</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">{t('settings.emailAlerts')}</p>
                    <p className="text-xs text-on-surface-variant">{t('settings.emailHint')}</p>
                  </div>
                  <button onClick={() => setEmailAlerts(v => !v)}
                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${emailAlerts ? 'bg-primary' : 'bg-outline-variant'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${emailAlerts ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="bg-primary/5 px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-widest text-primary uppercase">{t('settings.security')}</p>
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('settings.currentPw')}</label>
                  <input type={showPw ? 'text' : 'password'} value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('settings.newPw')}</label>
                    <input type={showPw ? 'text' : 'password'} value={pwForm.next}
                      onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                      placeholder={t('settings.minChars')}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('settings.confirmPw')}</label>
                    <input type={showPw ? 'text' : 'password'} value={pwForm.confirm}
                      onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder={t('settings.repeatNewPw')}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer select-none">
                  <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary" />
                  {t('settings.showPw')}
                </label>
                {pwErr && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{pwErr}</p>}
                {pwOk  && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {t('settings.pwUpdated')}
                  </p>
                )}
                <button onClick={submitPassword} disabled={pwMut.isPending}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">key</span>
                  {pwMut.isPending ? t('settings.updating') : t('settings.updatePw')}
                </button>
              </div>
            </div>

            {/* App settings */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="bg-primary/5 px-6 py-4 border-b border-outline-variant/20">
                <p className="text-[11px] font-bold tracking-widest text-primary uppercase">{t('settings.app')}</p>
              </div>
              <div className="divide-y divide-outline-variant/20">
                <div className="flex items-center gap-4 px-6 py-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">dark_mode</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">{t('settings.theme')}</p>
                    <p className="text-xs text-on-surface-variant">{t('settings.themeHint')}</p>
                  </div>
                  <div className="flex gap-1 bg-surface-container rounded-xl p-1 shrink-0">
                    <button className="px-3 py-1.5 rounded-lg bg-white text-xs font-bold text-on-surface shadow-sm">{t('settings.themeLight')}</button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors">{t('settings.themeDark')}</button>
                  </div>
                </div>
                <div className="flex items-center gap-4 px-6 py-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">language</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">{t('settings.language')}</p>
                    <p className="text-xs text-on-surface-variant">{t('settings.languageHint')}</p>
                  </div>
                  <LanguageToggle />
                </div>
                <div className="flex items-center gap-4 px-6 py-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">info</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">{t('settings.appVersion')}</p>
                    <p className="text-xs text-on-surface-variant">{t('settings.appHint')}</p>
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg">v1.0</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sign out + version — always at the bottom on all screen sizes */}
        <div className="mt-6 space-y-3">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-error-container text-error font-bold text-base hover:opacity-90 transition-opacity shadow-sm border border-error/10"
          >
            <span className="material-symbols-outlined">logout</span>
            {t('settings.signOut')}
          </button>
          <p className="text-center text-[10px] text-on-surface-variant uppercase tracking-widest">
            {t('nav.roboticsPortal')} · {isOwner ? t('settings.ownerEdition') : t('settings.staffEdition')}
          </p>
        </div>
      </div>

      {/* Profile edit modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProfileModal(false)} />
          <div className="relative bg-background rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-on-surface">{t('settings.editProfileTitle')}</h3>
              <button onClick={() => setProfileModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('settings.displayName')}</label>
                <input type="text" value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('settings.yourName')}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">{t('settings.phoneNumber')}</label>
                <input type="tel" value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder={t('settings.phonePlace')}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {profileErr && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{profileErr}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setProfileModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => profileMut.mutate({ name: profileForm.name || undefined, phone: profileForm.phone || undefined })}
                disabled={profileMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {profileMut.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
