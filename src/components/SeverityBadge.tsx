'use client';

import React from 'react';
import { Severity } from '@/types/incident';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const styles: Record<Severity, string> = {
    SEV1: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
    SEV2: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    SEV3: 'bg-yellow-950/80 text-yellow-300 border-yellow-800/80',
    SEV4: 'bg-slate-900 text-slate-300 border-slate-700',
  };

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-black',
  };

  return (
    <span
      className={`font-mono font-bold rounded border uppercase tracking-wider ${styles[severity] || styles.SEV4} ${sizeClasses[size]}`}
    >
      {severity}
    </span>
  );
};

export default SeverityBadge;
