'use client';

import React from 'react';
import { useAISpeaker } from '@/hooks/useAISpeaker';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { AudioLines, Volume2 } from 'lucide-react';

interface AISpeakerPanelProps {
  incidentId: string;
  enabled?: boolean;
  className?: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  CONFLICT_DETECTED: 'Conflict detected',
  DECISION_DISCUSSED: 'Decision discussed',
  ACTION_ASSIGNED: 'Action assigned',
  CRITICAL_ACTION_CONFIRMATION: 'Approval needed',
  INCIDENT_STATE_CHANGE: 'Status changed',
  USER_REQUESTED_STATUS: 'Status request',
  PERIODIC_STATUS: 'Periodic update',
};

export function AISpeakerPanel({ incidentId, enabled = true, className = '' }: AISpeakerPanelProps) {
  const { session, utterances, requestStatus } = useAISpeaker({ incidentId, enabled });
  const speaking = !!session?.speaking;
  const currentText = session?.currentText || null;

  return (
    <div className={`landing-card p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
            speaking ? 'bg-green-500 text-black animate-pulse' : 'bg-white/10 text-white/60'
          }`}>
            AI
          </div>
          <div>
            <p className="text-sm font-semibold">AI Commander</p>
            <p className="text-xs text-white/40">Voice assistant</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
          speaking ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/40 border border-white/10'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${speaking ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
          {speaking ? 'Speaking' : 'Idle'}
        </span>
      </div>

      <AudioVisualizer isSpeaking={speaking} isMuted={false} />

      {speaking && currentText && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-200">
          <div className="flex items-center gap-1.5 text-xs text-green-400 mb-1">
            <Volume2 className="w-3 h-3" />
            Now speaking
          </div>
          {currentText}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/40 flex items-center gap-1">
            <AudioLines className="w-3.5 h-3.5" />
            AI transcript
          </span>
          <button onClick={requestStatus} className="text-xs text-[#33d1ff] hover:text-[#33d1ff]/80 font-medium">
            Request update
          </button>
        </div>
        <div className="max-h-40 overflow-y-auto space-y-2">
          {utterances.length === 0 && (
            <p className="text-xs text-white/30 text-center py-3">AI hasn&apos;t spoken yet.</p>
          )}
          {utterances.map((u) => (
            <div key={u.id} className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                <span className="text-[#33d1ff]">{TRIGGER_LABELS[u.trigger] || u.trigger}</span>
                <span>{new Date(u.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">{u.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AISpeakerPanel;
