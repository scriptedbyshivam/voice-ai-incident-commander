'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AiUtteranceSummary } from '@/types/incident';

export interface AISpeakerSession {
  incidentId: string;
  speaking: boolean;
  currentText: string | null;
  currentTrigger: string | null;
  lastSpokenAt: string | null;
}

interface UseAISpeakerOptions {
  incidentId: string;
  enabled?: boolean;
  pollIntervalMs?: number;
  /** Called whenever a newly persisted utterance has audio available. */
  onUtterance?: (utterance: AiUtteranceSummary) => void;
}

interface UseAISpeakerResult {
  session: AISpeakerSession | null;
  utterances: AiUtteranceSummary[];
  /** Ask the AI for a spoken status update. */
  requestStatus: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string | null;
}

const EMPTY_SESSION: AISpeakerSession = {
  incidentId: '',
  speaking: false,
  currentText: null,
  currentTrigger: null,
  lastSpokenAt: null,
};

/**
 * Keeps the UI in sync with the AI Incident Commander's spoken participation.
 * Polls the lightweight speak endpoint (utters + session) and surfaces what the
 * AI just said so dashboards/rooms can render the 🟢 Speaking indicator and the
 * transcript of the AI's own words.
 */
export function useAISpeaker({
  incidentId,
  enabled = true,
  pollIntervalMs = 1500,
  onUtterance,
}: UseAISpeakerOptions): UseAISpeakerResult {
  const [session, setSession] = useState<AISpeakerSession | null>(null);
  const [utterances, setUtterances] = useState<AiUtteranceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const onUtteranceRef = useRef(onUtterance);

  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  const refresh = useCallback(async () => {
    if (!incidentId || !enabled) return;
    try {
      const res = await fetch(`/api/incidents/${incidentId}/ai/speak?limit=12`);
      if (!res.ok) throw new Error('Failed to load AI speaker state');
      const data = await res.json();

      setSession((prev) => {
        const merged: AISpeakerSession = {
          ...EMPTY_SESSION,
          ...(prev || {}),
          ...data.session,
          incidentId,
        };
        return merged;
      });

      if (Array.isArray(data.utterances)) {
        setUtterances(data.utterances);
        // Notify consumers of fresh audio-bearing utterances.
        const newest = data.utterances[0];
        if (newest && newest.id !== lastIdRef.current) {
          lastIdRef.current = newest.id;
          if (newest.audioUrl) onUtteranceRef.current?.(newest);
        }
      }
      setError(null);
    } catch {
      // Polling is best-effort — keep previous UI state on transient failures.
      setError('AI speaker state unavailable');
    }
  }, [incidentId, enabled]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSession((prev) => (prev && prev.incidentId === incidentId ? prev : null));
    lastIdRef.current = null;
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [incidentId]);

  useEffect(() => {
    if (!enabled || !incidentId) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(timer);
  }, [enabled, incidentId, pollIntervalMs, refresh]);

  const requestStatus = useCallback(async () => {
    if (!incidentId) return;
    try {
      await fetch(`/api/incidents/${incidentId}/ai/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'status' }),
      });
      await refresh().catch(() => {});
    } catch {
      // Non-fatal — the panel still shows the last known state.
    }
  }, [incidentId, refresh]);

  return { session, utterances, requestStatus, refresh, error };
}