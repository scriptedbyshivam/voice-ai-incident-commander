'use client';

import React from 'react';
import { Severity } from '@/types/incident';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const styles: Record<Severity, string> = {
    SEV1: 'badge-sev1',
    SEV2: 'badge-sev2',
    SEV3: 'badge-sev3',
    SEV4: 'badge-sev4',
  };

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  return (
    <span className={`font-semibold rounded-full ${styles[severity] || styles.SEV4} ${sizeClasses[size]}`}>
      {severity}
    </span>
  );
};

export default SeverityBadge;
