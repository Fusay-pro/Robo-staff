'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from '@/lib/api';

const CAL_DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMondayFirst(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  return first === 0 ? 6 : first - 1;
}
function fmtDisplay(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

interface Props {
  onClose: () => void;
}

export default function HolidayWizardModal({ onClose }: Props) {
  const qc = useQueryClient();
  const today = new Date();

  const [holStep, setHolStep]     = useState(1);
  const [holName, setHolName]     = useState('');
  const [holFrom, setHolFrom]     = useState('');
  const [holTo, setHolTo]         = useState('');
  const [holSelecting, setHolSelecting] = useState<'from' | 'to' | null>('from');
  const [holCalYear, setHolCalYear]   = useState(today.getFullYear());
  const [holCalMonth, setHolCalMonth] = useState(today.getMonth());
  const [holError, setHolError]   = useState('');
  const [holSubmitting, setHolSubmitting] = useState(false);

  const holFirstDay    = getMondayFirst(holCalYear, holCalMonth);
  const holDaysInMonth = new Date(holCalYear, holCalMonth + 1, 0).getDate();

  const { data: holPreview = [], isFetching: holPreviewing } = useQuery<any[]>({
    queryKey: ['holidays-preview', holFrom, holTo],
    queryFn:  () => client.get(`/schedules?from=${holFrom}&to=${holTo}&limit=200`).then(r => r.data?.data ?? []),
    enabled:  holStep === 2 && !!holFrom && !!holTo,
  });

  const holMut = useMutation({
    mutationFn: () => client.post('/holidays', { name: holName, start_date: holFrom, end_date: holTo }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules-list'] });
      qc.invalidateQueries({ queryKey: ['schedules-month'] });
      qc.invalidateQueries({ queryKey: ['holidays'] });
      onClose();
    },
    onError: (e: any) => setHolError(e?.response?.data?.error || 'Failed to create holiday'),
  });

  function pickHolDay(dateStr: string) {
    if (holSelecting === 'from') {
      setHolFrom(dateStr);
      if (holTo && dateStr > holTo) setHolTo('');
      setHolSelecting('to');
    } else {
      if (dateStr < holFrom) { setHolFrom(dateStr); setHolTo(''); setHolSelecting('to'); return; }
      setHolTo(dateStr);
      setHolSelecting(null);
    }
  }

  function isDayInRange(dateStr: string) {
    return holFrom && holTo && dateStr >= holFrom && dateStr <= holTo;
  }

  async function holSubmit() {
    setHolError(''); setHolSubmitting(true);
    try {
      await holMut.mutateAsync();
    } catch {
      // error set in onError
    } finally {
      setHolSubmitting(false);
    }
  }

  const STEP_LABELS = ['Name & Dates', 'Preview', 'Confirm'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-3xl shadow-2xl z-10 w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="bg-amber-500 px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Step {holStep} of 3</p>
              <h3 className="text-xl font-bold text-white">{STEP_LABELS[holStep - 1]}</h3>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
              <span className="material-symbols-outlined text-white text-[20px]">close</span>
            </button>
          </div>
          <div className="flex gap-1.5">
            {[1,2,3].map(s => (
              <div key={s} className={`h-1 rounded-full flex-1 transition-all duration-300 ${s <= holStep ? 'bg-white' : 'bg-white/25'}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 1: Name & date range */}
          {holStep === 1 && (
            <>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Holiday Name</label>
                <input value={holName} onChange={e => setHolName(e.target.value)}
                  placeholder="e.g. Songkran, Christmas…"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Date Range</label>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setHolSelecting('from')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${holSelecting === 'from' ? 'bg-amber-500 text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                      From
                    </button>
                    <button onClick={() => setHolSelecting('to')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${holSelecting === 'to' ? 'bg-amber-500 text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                      To
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { if (holCalMonth === 0) { setHolCalMonth(11); setHolCalYear(y => y-1); } else setHolCalMonth(m => m-1); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_left</span>
                      </button>
                      <span className="font-bold text-on-surface text-sm min-w-[120px] text-center">{MONTHS[holCalMonth]} {holCalYear}</span>
                      <button onClick={() => { if (holCalMonth === 11) { setHolCalMonth(0); setHolCalYear(y => y+1); } else setHolCalMonth(m => m+1); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setHolCalYear(y => y-1)} className="text-[10px] font-bold text-on-surface-variant hover:text-amber-500 px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors">{holCalYear-1}</button>
                      <button onClick={() => setHolCalYear(y => y+1)} className="text-[10px] font-bold text-on-surface-variant hover:text-amber-500 px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors">{holCalYear+1}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {CAL_DAYS.map(d => <div key={d} className="text-center text-[9px] font-bold text-on-surface-variant py-1 tracking-wider">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: holFirstDay }).map((_,i) => <div key={`e${i}`} />)}
                    {Array.from({ length: holDaysInMonth }).map((_,i) => {
                      const day     = i + 1;
                      const dateStr = toDateStr(new Date(holCalYear, holCalMonth, day));
                      const isFrom  = dateStr === holFrom;
                      const isTo    = dateStr === holTo;
                      const inRange = isDayInRange(dateStr);
                      const isTod   = dateStr === toDateStr(today);
                      return (
                        <button key={day} onClick={() => pickHolDay(dateStr)}
                          className={`h-8 w-full rounded-lg text-xs font-semibold transition-all ${
                            isFrom || isTo ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                            : inRange ? 'bg-amber-100 text-amber-800'
                            : isTod  ? 'bg-amber-50 text-amber-600 font-bold'
                            : 'hover:bg-surface-container text-on-surface'
                          }`}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-3 mt-3">
                  <div className={`flex-1 rounded-xl px-3 py-2 border text-xs font-semibold ${holFrom ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-outline-variant/30 text-on-surface-variant'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5 opacity-60">From</span>
                    {holFrom ? fmtDisplay(holFrom) : <span className="text-on-surface-variant/50">Not set</span>}
                  </div>
                  <div className={`flex-1 rounded-xl px-3 py-2 border text-xs font-semibold ${holTo ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-outline-variant/30 text-on-surface-variant'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5 opacity-60">To</span>
                    {holTo ? fmtDisplay(holTo) : <span className="text-on-surface-variant/50">Not set</span>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Preview sessions to cancel */}
          {holStep === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-amber-500 text-xl">event_busy</span>
                <div>
                  <p className="font-bold text-on-surface text-sm">Sessions in this period</p>
                  <p className="text-xs text-on-surface-variant">{fmtDisplay(holFrom)} → {fmtDisplay(holTo)}</p>
                </div>
              </div>
              {holPreviewing ? (
                <div className="py-8 flex items-center justify-center gap-2 text-on-surface-variant">
                  <div className="w-4 h-4 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading sessions…</span>
                </div>
              ) : holPreview.length === 0 ? (
                <div className="py-8 text-center">
                  <span className="material-symbols-outlined text-2xl text-emerald-500 block mb-2">check_circle</span>
                  <p className="text-sm font-semibold text-on-surface">No sessions in this period</p>
                  <p className="text-xs text-on-surface-variant mt-1">No sessions will be cancelled.</p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[18px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    <p className="text-xs text-amber-800 font-semibold">
                      {holPreview.length} session{holPreview.length !== 1 ? 's' : ''} will be cancelled.
                    </p>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {holPreview.map((s: any) => {
                      const dt = new Date(s.starts_at);
                      return (
                        <div key={s.schedule_id} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5 border border-outline-variant/20">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-amber-700 uppercase leading-none">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]}</span>
                            <span className="text-sm font-bold text-amber-800 leading-none">{dt.getDate()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-on-surface text-sm truncate">{s.course_name || 'Session'}</p>
                            <p className="text-xs text-on-surface-variant">{fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}</p>
                          </div>
                          {s.enrolled_count > 0 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                              {s.enrolled_count} enrolled
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {holStep === 3 && (
            <>
              <p className="text-sm text-on-surface-variant">Review and confirm creating this holiday.</p>
              <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/20 divide-y divide-outline-variant/20">
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-amber-600 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>sunny</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Holiday Name</p>
                    <p className="font-bold text-on-surface">{holName}</p>
                  </div>
                </div>
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-amber-600 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>date_range</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Date Range</p>
                    <p className="font-bold text-on-surface">{fmtDisplay(holFrom)}</p>
                    {holTo !== holFrom && <p className="text-sm text-on-surface-variant mt-0.5">→ {fmtDisplay(holTo)}</p>}
                  </div>
                </div>
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-amber-600 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Impact</p>
                    {holPreview.length === 0
                      ? <p className="font-bold text-emerald-700">No sessions cancelled</p>
                      : <p className="font-bold text-amber-700">{holPreview.length} session{holPreview.length !== 1 ? 's' : ''} will be cancelled</p>
                    }
                  </div>
                </div>
              </div>
            </>
          )}

          {holError && <p className="text-xs text-error bg-error-container/30 rounded-xl px-3 py-2">{holError}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 shrink-0 bg-surface">
          <button onClick={holStep === 1 ? onClose : () => { setHolStep(s => s-1); setHolError(''); }}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            {holStep === 1 ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={() => {
              setHolError('');
              if (holStep === 1) {
                if (!holName.trim()) { setHolError('Please enter a holiday name'); return; }
                if (!holFrom) { setHolError('Please select a start date'); return; }
                if (!holTo)   { setHolError('Please select an end date'); return; }
                setHolStep(2);
              } else if (holStep === 2) {
                setHolStep(3);
              } else {
                holSubmit();
              }
            }}
            disabled={holSubmitting || (holStep === 2 && holPreviewing)}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
            {holSubmitting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</>
              : holStep === 3
              ? <><span className="material-symbols-outlined text-[16px]">check</span>Create Holiday</>
              : <>{holStep === 2 ? 'Confirm' : 'Next'}<span className="material-symbols-outlined text-[16px]">arrow_forward</span></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
