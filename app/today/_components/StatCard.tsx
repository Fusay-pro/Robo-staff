'use client';

export default function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="flex-1 bg-surface-container-lowest rounded-xl px-3 py-3 md:px-5 md:py-4 flex items-center gap-3 shadow-md border border-outline-variant/30">
      <div className={`w-10 h-10 rounded-xl items-center justify-center shrink-0 hidden md:flex ${color}`}>
        <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div>
        <p className="text-xl md:text-2xl font-bold text-on-surface leading-none">{value}</p>
        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}
