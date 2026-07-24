import React from 'react';

export default function GlassCard({ children, className = '', id, onClick, style }) {
  return (
    <div
      id={id}
      onClick={onClick}
      style={style}
      className={`bg-white/78 backdrop-blur-xl border border-sky-100/70 rounded-3xl shadow-xl shadow-sky-950/[0.06] transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
}
