'use client';

import React from 'react';

type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

interface ActionStatusBadgeProps {
  status: ActionStatus;
}

export const ActionStatusBadge: React.FC<ActionStatusBadgeProps> = ({ status }) => {
  const badgeStyles: Record<ActionStatus, string> = {
    PENDING: 'bg-slate-900 text-slate-400 border-slate-700',
    IN_PROGRESS: 'bg-indigo-950 text-indigo-300 border-indigo-800',
    BLOCKED: 'bg-rose-950 text-rose-300 border-rose-800',
    COMPLETED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    CANCELLED: 'bg-slate-950 text-slate-600 border-slate-850 line-through',
  };

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badgeStyles[status] || badgeStyles.PENDING}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

export default ActionStatusBadge;
