'use client';

import React from 'react';
import Link from 'next/link';
import { Radio, FileText } from 'lucide-react';

interface QuickActionBarProps {
  incidentId: string;
  onExportReport: () => void;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({ incidentId, onExportReport }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 landing-card">
      <Link
        href={`/incidents/${incidentId}/room`}
        className="btn-landing-primary text-xs py-2 px-3"
      >
        <Radio className="w-3.5 h-3.5" />
        Join voice room
      </Link>
      <button onClick={onExportReport} className="btn-landing-outline text-xs py-2 px-3">
        <FileText className="w-3.5 h-3.5" />
        Export report
      </button>
    </div>
  );
};

export default QuickActionBar;
