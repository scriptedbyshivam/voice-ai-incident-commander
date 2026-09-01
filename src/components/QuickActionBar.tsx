'use client';

import React from 'react';
import Link from 'next/link';

interface QuickActionBarProps {
  incidentId: string;
  onExportReport: () => void;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({ incidentId, onExportReport }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-900/60 border border-slate-800 rounded-xl backdrop-blur-md">
      <Link
        href={`/incidents/${incidentId}/room`}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5"
      >
        🎙️ Join Voice Room
      </Link>
      <button
        onClick={onExportReport}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5"
      >
        📄 Export Post-Mortem
      </button>
    </div>
  );
};

export default QuickActionBar;
