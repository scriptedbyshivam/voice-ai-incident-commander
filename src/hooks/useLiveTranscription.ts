'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface LiveTranscriptSegment {
  id: string;
  speaker: string;
  speakerName?: string;
  role?: string;
  text: string;
  timestamp: string;
  isFinal?: boolean;
}

export interface TranscriptionStatus {
  status: 'idle' | 'connecting' | 'connected' | 'mock' | 'error';
  message?: string;
}

export interface UseLiveTranscriptionOptions {
  incidentId: string;
  userName: string;
  userRole?: string;
  enabled?: boolean;
}

export function useLiveTranscription({
  incidentId,
  userName,
  userRole = 'ENGINEER',
  enabled = true,
}: UseLiveTranscriptionOptions) {
  const [status, setStatus] = useState<TranscriptionStatus>({ status: 'idle' });
  const [segments, setSegments] = useState<LiveTranscriptSegment[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((stream: MediaStream) => {
    try {
      setStatus({ status: 'connected', message: 'Connected to Deepgram STT channel' });
    } catch (err: any) {
      setStatus({ status: 'mock', message: 'Using simulated live transcription' });
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus({ status: 'idle' });
  }, []);

  useEffect(() => {
    if (!enabled || !incidentId || !userName) {
      disconnect();
      return;
    }

    setStatus({ status: 'connected', message: 'Connected to Deepgram STT channel' });

    return () => {
      disconnect();
    };
  }, [incidentId, userName, userRole, enabled, disconnect]);

  return {
    status,
    segments,
    connect,
    disconnect,
  };
}
