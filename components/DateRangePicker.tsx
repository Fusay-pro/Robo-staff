'use client';

import { useState, useRef, useEffect } from 'react';

const DAYS_HEADER = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getMondayFirst(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseISO(s: string) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function inRange(date: Date, from: Date | null, to: Date | null) {
  if (!from || !to) return false;
  const t = date.getTime();
  return t > from.getTime() && t < to.getTime();
}

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
}

export default function DateRangePicker({ from, to, onChange, placeholder = 'Select date range' }: Props) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [hovered, setHovered] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fromDate = parseISO(from);
  const toDate   = parseISO(to);
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = getMondayFirst(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const displayLabel = from && to
    ? `${new Date(from + 'T00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })} – ${new Date(to + 'T00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}`
    : from
    ? `From ${new Date(from + 'T00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}`
    : placeholder;

  function handleDayClick(day: Date) {
    if (selecting === 'from') {
      onChange(toISO(day), '');
      setSelecting('to');
    } else {
      if (fromDate && day < fromDate) {
        // clicked before from → swap
        onChange(toISO(day), from);
      } else {
        onChange(from, toISO(day));
      }
      setSelecting('from');
      setOpen(false);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('', '');
    setSelecting('from');
  }

  const effectiveTo = selecting === 'to' && hovered && fromDate
    ? (hovered > fromDate ? hovered : fromDate)
    : toDate;
  const effectiveFrom = selecting === 'to' && hovered && fromDate
    ? (hovered < fromDate ? hovered : fromDate)
    : fromDate;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
          open
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:border-primary/40'
        }`}
      >
        <span className="material-symbols-outlined text-[16px] shrink-0"
          style={{ color: open || (from || to) ? undefined : undefined }}>
          date_range
        </span>
        <span className={from || to ? 'text-on-surface font-medium' : 'text-on-surface-variant'}>
          {displayLabel}
        </span>
        {(from || to) && (
          <span
            onClick={clear}
            className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-on-surface ml-1 cursor-pointer"
          >
            close
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-background rounded-2xl shadow-2xl border border-outline-variant/20 p-4 w-72">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_left</span>
            </button>
            <p className="text-sm font-bold text-on-surface">{MONTHS_FULL[month]} {year}</p>
            <button
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_HEADER.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-on-surface-variant py-1 tracking-wider">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const iso = toISO(date);
              const isFrom = iso === from;
              const isTo   = iso === to;
              const isEndpoint = isFrom || isTo;
              const isInRange = inRange(date, effectiveFrom, effectiveTo);
              const isToday  = iso === toISO(today);
              const isHoverEnd = selecting === 'to' && hovered && toISO(hovered) === iso;

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(date)}
                  onMouseEnter={() => setHovered(date)}
                  onMouseLeave={() => setHovered(null)}
                  className={`relative h-8 text-xs font-semibold flex items-center justify-center transition-all
                    ${isEndpoint
                      ? 'bg-primary text-white rounded-lg z-10'
                      : isHoverEnd
                      ? 'bg-primary/80 text-white rounded-lg z-10'
                      : isInRange
                      ? 'bg-primary/10 text-primary'
                      : isToday
                      ? 'text-primary font-bold'
                      : 'text-on-surface hover:bg-surface-container rounded-lg'
                    }
                    ${isInRange && !isEndpoint ? (
                        day === 1 || new Date(year, month, day - 1).getDay() === 0 ? 'rounded-l-lg' :
                        day === daysInMonth || new Date(year, month, day + 1).getDay() === 1 ? 'rounded-r-lg' : ''
                      ) : ''
                    }
                  `}
                >
                  {day}
                  {isToday && !isEndpoint && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <p className="text-center text-[10px] text-on-surface-variant mt-3">
            {selecting === 'from' ? 'Select start date' : 'Select end date'}
          </p>

          {(from || to) && (
            <button onClick={clear} className="w-full mt-2 text-xs text-error font-semibold hover:underline py-1">
              Clear range
            </button>
          )}
        </div>
      )}
    </div>
  );
}
