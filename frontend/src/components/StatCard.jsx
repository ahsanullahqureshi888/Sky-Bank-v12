import React from 'react';
import GlassCard from './GlassCard';

export default function StatCard({ title, value, icon: Icon, colorClass = 'text-sky-600', bgClass = 'bg-white' }) {
  return (
    <div className={`relative flex flex-col min-h-[120px] justify-between p-4 xl:p-5 overflow-hidden rounded-[24px] shadow-sm border border-white/60 ${bgClass} group transition-all duration-300 hover:shadow-md hover:-translate-y-1`}>
      <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity pointer-events-none transform translate-x-2 -translate-y-2">
        {Icon && <Icon size={80} />}
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm bg-white/80 backdrop-blur-md border border-white/60 ${colorClass}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500/80 mb-1">{title}</p>
        <h3 className="text-xl xl:text-2xl font-black leading-tight text-slate-900 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis" title={value}>{value}</h3>
      </div>
    </div>
  );
}
