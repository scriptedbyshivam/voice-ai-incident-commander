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

const WS_URL = process.env.TRANSCRIPTION_WS_URL || 'ws://localhost:3001';

export function useLiveTranscription({
  incidentId,
  userName,
  userRole = 'ENGINEER',
  enabled = true,
}: UseLiveTranscriptionOptions) {
  const [status, setStatus] = useState<TranscriptionStatus>({ status: 'idle' });
  const [segments, setSegments] = useState<LiveTranscriptSegment[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !incidentId || !userName) return;

    setStatus({ status: 'connecting', message: 'Requesting microphone access...' });

    try {
      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Connect WebSocket to transcription server
      const params = new URLSearchParams({ incidentId, userName, userRole });
      const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus({ status: 'connected', message: 'Connected to transcription server' });

        // 3. Set up audio processing — capture raw PCM and send to server
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);

        // ScriptProcessorNode for raw audio capture (16kHz mono)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);

          // Resample to 16kHz if needed
          const sampleRate = audioContext.sampleRate;
          let audioData: Float32Array;

          if (sampleRate !== 16000) {
            const ratio = 16000 / sampleRate;
            const newLength = Math.round(inputData.length * ratio);
            audioData = new Float32Array(newLength);
            for (let i = 0; i < newLength; i++) {
              const srcIndex = i / ratio;
              const index = Math.floor(srcIndex);
              const frac = srcIndex - index;
              audioData[i] = index + 1 < inputData.length
                ? inputData[index] * (1 - frac) + inputData[index + 1] * frac
                : inputData[index] || 0;
            }
          } else {
            audioData = inputData;
          }

          // Convert Float32 to Int16 (linear16 PCM)
          const int16 = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            const s = Math.max(-1, Math.min(1, audioData[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Send raw PCM bytes
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'transcript.partial' || msg.type === 'transcript.final') {
            const t = msg.transcript;
            if (!t) return;

            const segment: LiveTranscriptSegment = {
              id: t.id || `seg-${Date.now()}`,
              speaker: t.speakerName || 'Unknown',
              speakerName: t.speakerName,
              role: t.speakerRole,
              text: t.text,
              timestamp: t.timestamp || new Date().toISOString(),
              isFinal: msg.type === 'transcript.final',
            };

            setSegments((prev) => {
              // If final, replace any partial with same speaker+text prefix
              if (segment.isFinal) {
                const filtered = prev.filter(
                  (s) => !(s.speaker === segment.speaker && !s.isFinal && segment.text.startsWith(s.text))
                );
                return [...filtered, segment];
              }
              // Partial — update or add
              const existingIdx = prev.findIndex((s) => s.id === segment.id);
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = segment;
                return updated;
              }
              return [...prev, segment];
            });
          } else if (msg.type === 'connected') {
            console.log('[Transcription] Connected:', msg.clientId);
          } else if (msg.type === 'transcript.error') {
            setStatus({ status: 'error', message: msg.error || 'Transcription error' });
          }
        } catch {
          // Ignore unparseable messages
        }
      };

      ws.onerror = () => {
        setStatus({ status: 'mock', message: 'WebSocket error — using mock mode' });
      };

      ws.onclose = () => {
        setStatus((prev) =>
          prev.status === 'connected'
            ? { status: 'mock', message: 'Disconnected from transcription server' }
            : prev
        );
      };
    } catch (err) {
      console.warn('[Transcription] Microphone or WS error:', err);
      setStatus({ status: 'mock', message: 'Mic unavailable — using simulated transcription' });
    }
  }, [incidentId, userName, userRole, enabled]);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus({ status: 'idle' });
    setSegments([]);
  }, [cleanup]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!enabled || !incidentId || !userName) {
      disconnect();
      return;
    }

    connect();

    return () => {
      cleanup();
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [incidentId, userName, userRole, enabled, connect, disconnect, cleanup]);

  return {
    status,
    segments,
    connect,
    disconnect,
  };
}
