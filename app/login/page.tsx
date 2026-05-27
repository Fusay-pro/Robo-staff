'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import LanguageToggle from '@/components/LanguageToggle';
import client from '@/lib/api';
import { decodeJwt } from '@/lib/auth';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await client.post('/auth/login', { email: email.trim(), password });
      const payload = decodeJwt(data.access_token);
      const staffRoles = ['owner', 'super_owner', 'staff'];
      if (!payload || !staffRoles.includes(payload.role)) {
        setError(t('login.wrongPortal'));
        return;
      }
      signIn(data.access_token, data.refresh_token);
      const isOwner = payload.role === 'owner' || payload.role === 'super_owner';
      router.replace(isOwner ? '/dashboard' : '/today');
    } catch (err: any) {
      if (!err.response) setError('Cannot connect to server. Is the backend running?');
      else setError(err.response.data?.error || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #006686 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>precision_manufacturing</span>
          </div>
          <span className="text-white font-bold text-xl">RoboKids Staff</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Manage<br />Sessions &<br />Students
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-sm">
            Your all-in-one portal for managing daily sessions, approvals, schedules and finances.
          </p>
        </div>

      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>precision_manufacturing</span>
            </div>
            <span className="text-primary font-bold text-xl">RoboKids Staff</span>
          </div>

          <div className="mb-10 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-3xl font-bold text-on-surface">{t('login.title')}</h2>
              <p className="text-on-surface-variant mt-2">{t('login.subtitle')}</p>
            </div>
            <LanguageToggle />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface-variant">{t('login.email')}</label>
              <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                <span className="material-symbols-outlined text-outline text-[20px]">mail</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@example.com" required
                  className="flex-1 bg-transparent border-none focus:ring-0 py-3.5 text-on-surface placeholder:text-outline outline-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface-variant">{t('login.password')}</label>
              <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  className="flex-1 bg-transparent border-none focus:ring-0 py-3.5 text-on-surface placeholder:text-outline outline-none" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-error bg-error-container/40 px-4 py-3 rounded-xl">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-on-primary font-semibold py-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>{t('login.signIn')} <span className="material-symbols-outlined text-[20px]">arrow_forward</span></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
