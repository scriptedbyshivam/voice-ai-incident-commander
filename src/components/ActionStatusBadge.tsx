'use client';

import React from 'react';

type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

interface ActionStatusBadgeProps {
  status: ActionStatus;
}

export const ActionStatusBadge: React.FC<ActionStatusBadgeProps> = ({ status }) => {
  const badgeStyles: Record<ActionStatus, string> = {
    PENDING: 'badge-pending',
    IN_PROGRESS: 'bg-[#33d1ff]/15 text-[#33d1ff] border border-[#33d1ff]/30',
    BLOCKED: 'bg-red-500/15 text-red-400 border border-red-500/30',
    COMPLETED: 'badge-confirmed',
    CANCELLED: 'bg-white/5 text-white/30 border border-white/10 line-through',
  };

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeStyles[status] || badgeStyles.PENDING}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

export default ActionStatusBadge;
