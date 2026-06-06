'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import client from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import StaffAlertDropdown from './bell/StaffAlertDropdown';

// Dismissed notifications — keys map to expiry timestamp (24h TTL).
const DISMISS_KEY = 'staff_dismissed_alerts_v1';
const TTL_LIVE    = 24 * 60 * 60 * 1000;

function loadDismissed(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const live: Record<string, number> = {};
    for (const k in data) if (data[k] > now) live[k] = data[k];
    return live;
  } catch { return {}; }
}
function persistDismiss(key: string) {
  if (typeof window === 'undefined') return;
  const data = loadDismissed();
  data[key] = Date.now() + TTL_LIVE;
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [dismissedTick, setDismissedTick] = useState(0);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0, isMobile: false });
  const { role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_owner';
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const autoOpenedRef = useRef(false);

  function computeDropPos() {
    if (!btnRef.current || typeof window === 'undefined') return;
    const r = btnRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    setDropPos({
      top: r.bottom + 8,
      right: Math.max(8, window.innerWidth - r.right),
      isMobile,
    });
  }

  const { data } = useQuery<any>({
    queryKey: ['alerts-feed'],
    queryFn: () => client.get('/schedules/alerts').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      const insideBtn = btnRef.current?.contains(target);
      const insideDrop = dropRef.current?.contains(target);
      if (!insideBtn && !insideDrop) setOpen(false);
    }
    if (open) document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    computeDropPos();
    window.addEventListener('resize', computeDropPos);
    window.addEventListener('scroll', computeDropPos, true);
    return () => {
      window.removeEventListener('resize', computeDropPos);
      window.removeEventListener('scroll', computeDropPos, true);
    };
  }, [open]);

  const dismissed = useMemo(() => loadDismissed(), [dismissedTick]);
  const isDismissed = (key: string) => key in dismissed;
  function dismiss(key: string) {
    persistDismiss(key);
    setDismissedTick(t => t + 1);
  }

  const nextRaw      = data?.next_session;
  const next         = nextRaw && !isDismissed(`next-${nextRaw.schedule_id}`) ? nextRaw : null;
  const lowKidsRaw: any[] = data?.low_class_students ?? [];
  const lowKids      = lowKidsRaw.filter(k => !isDismissed(`lowkid-${k.student_id}-${k.schedule_id}`));
  const pendingCount: number = data?.pending_approvals ?? 0;
  const showPending  = isOwner && pendingCount > 0 && !isDismissed('pending-approvals');
  const cancelCount: number  = data?.pending_cancellations ?? 0;
  const showCancel   = isOwner && cancelCount > 0 && !isDismissed('pending-cancellations');

  const totalCount = (next ? 1 : 0) + lowKids.length + (showPending ? 1 : 0) + (showCancel ? 1 : 0);
  const markAllAsRead = () => {
    if (next) dismiss(`next-${next.schedule_id}`);
    lowKids.forEach((k: any) => dismiss(`lowkid-${k.student_id}-${k.schedule_id}`));
    if (showPending) dismiss('pending-approvals');
    if (showCancel) dismiss('pending-cancellations');
  };

  // Auto-open once per login/page load when alerts exist.
  useEffect(() => {
    if (typeof window === 'undefined' || autoOpenedRef.current || totalCount === 0) return;
    const t = setTimeout(() => {
      autoOpenedRef.current = true;
      computeDropPos();
      setOpen(true);
    }, 500);
    return () => clearTimeout(t);
  }, [totalCount]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          if (!open) computeDropPos();
          setOpen(v => !v);
        }}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors shrink-0"
      >
        <span className="material-symbols-outlined text-on-surface-variant text-[22px]" style={totalCount > 0 ? { fontVariationSettings: "'FILL' 1" } : {}}>
          notifications
        </span>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <StaffAlertDropdown
          dropRef={dropRef}
          dropPos={dropPos}
          next={next}
          lowKids={lowKids}
          pendingCount={pendingCount}
          showPending={showPending}
          cancelCount={cancelCount}
          showCancel={showCancel}
          totalCount={totalCount}
          dismiss={dismiss}
          markAllAsRead={markAllAsRead}
          onClose={() => setOpen(false)}
        />,
        document.body
      )}
    </div>
  );
}
