'use client';

import React, { useCallback, useEffect, useRef, useState, FormEvent } from 'react';
import { useAISpeaker } from '@/hooks/useAISpeaker';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { AudioLines, Volume2, Send, Sparkles, RefreshCcw } from 'lucide-react';

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

/** Resolve a possibly-relative audio URL against the current page origin. */
function toAbsoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.href).href;
}

/** Best-effort local browser speech fallback when no server audio decodes. */
function speakTextLocal(text: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  synth.speak(utterance);
}

let audioCtx: AudioContext | null = null;
let ctxUnlocked = false;

/**
 * Browsers block audio output until the user first interacts with the page.
 * Calling this from a click handler resumes the AudioContext, unlocking
 * programmatic playback (from polling callbacks) afterwards.
 */
function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  if (!audioCtx) {
    const AC: typeof AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  ctxUnlocked = true;
}

let activeSource: AudioBufferSourceNode | null = null;

/** Fetch + decode a server MP3 and play it through the (unlocked) context. */
async function playAudio(audioUrl: string, _fallbackText: string): Promise<void> {
  void _fallbackText;
  if (typeof window === 'undefined' || !audioCtx || !ctxUnlocked) {
    return Promise.reject(new Error('Audio not unlocked yet'));
  }
  const res = await fetch(toAbsoluteUrl(audioUrl));
  if (!res.ok) throw new Error('Audio fetch failed');
  const buffer = await res.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(buffer);
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      /* already stopped */
    }
  }
  activeSource = source;
  source.start();
}

export function AISpeakerPanel({ incidentId, enabled = true, className = '' }: AISpeakerPanelProps) {
  const { session, utterances, requestStatus } = useAISpeaker({
    incidentId,
    enabled,
    onUtterance: (u) => {
      if (u.audioUrl) {
        void playAudio(u.audioUrl, u.text).catch(() => speakTextLocal(u.text));
      } else {
        speakTextLocal(u.text);
      }
    },
  });
  const speaking = !!session?.speaking;
  const currentText = session?.currentText || null;
  const [prompt, setPrompt] = useState('');
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Browsers block audio until the user has interacted with the page. Every
  // button click below calls unlockAudio() so subsequent programmatic playback
  // (triggered from the polling callback) is allowed to make sound.
  const speakAI = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    unlockAudio();
    const q = (prompt || '').trim();
    if (!q || asking) return;
    setAsking(true);
    try {
      await fetch(`/api/incidents/${incidentId}/ai/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prompt', prompt: q }),
      });
      setPrompt('');
      // The onUtterance playback above will voice the AI's reply.
    } catch {
      // Non-fatal — surfaced by the transcript/status that follows.
    } finally {
      setAsking(false);
      inputRef.current?.focus();
    }
  }, [incidentId, prompt, asking]);

  const handleRequestStatus = useCallback(() => {
    unlockAudio();
    void requestStatus();
  }, [requestStatus]);

  // Tear down speech synthesis when unmounting.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

      <form onSubmit={speakAI} className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Sparkles className="w-4 h-4 text-[#33d1ff] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the AI… e.g. What escalated in the last hour?"
            className="w-full pl-9 pr-3 py-2 text-xs text-white/80 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#33d1ff]/60 focus:bg-white/[0.07] placeholder:text-white/30"
          />
        </div>
        <button
          type="submit"
          disabled={asking || !prompt.trim()}
          className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl bg-[#33d1ff] text-black hover:bg-[#33d1ff]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {asking ? 'Speaking…' : 'Speak'}
        </button>
      </form>

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
          <button
            onClick={handleRequestStatus}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#33d1ff] hover:bg-white/10 hover:border-[#33d1ff]/40 transition-colors"
          >
            <RefreshCcw className="w-3 h-3" />
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
