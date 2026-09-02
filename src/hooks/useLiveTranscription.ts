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
  const recognitionRef = useRef<any | null>(null);

  const sendTranscriptToBackend = useCallback(async (text: string, isFinal: boolean) => {
    if (!incidentId || !text.trim() || !isFinal) return;
    try {
      await fetch(`/api/incidents/${incidentId}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_segment',
          transcript: text,
          speakerName: userName,
          speakerRole: userRole,
        }),
      }).catch(() => null);
    } catch {
      // Best effort
    }
  }, [incidentId, userName, userRole]);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
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

  const startWebSpeechFallback = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus({ status: 'connected', message: 'Simulated voice transcription active' });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setStatus({ status: 'connected', message: 'Live microphone speech recognition active' });
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript;
          if (!text) continue;
          const isFinal = result.isFinal;

          const segment: LiveTranscriptSegment = {
            id: `speech-${Date.now()}-${i}`,
            speaker: userName,
            speakerName: userName,
            role: userRole,
            text: text.trim(),
            timestamp: new Date().toISOString(),
            isFinal,
          };

          setSegments((prev) => {
            if (isFinal) {
              sendTranscriptToBackend(segment.text, true);
              const filtered = prev.filter((s) => !(!s.isFinal && s.speaker === userName));
              return [...filtered, segment];
            }
            const existingIdx = prev.findIndex((s) => !s.isFinal && s.speaker === userName);
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = segment;
              return updated;
            }
            return [...prev, segment];
          });
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('[WebSpeech] Recognition error:', err);
      };

      recognition.onend = () => {
        // Auto-restart if still enabled
        if (enabled && recognitionRef.current) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[WebSpeech] Could not start speech recognition:', err);
    }
  }, [enabled, userName, userRole, sendTranscriptToBackend]);

  const connect = useCallback(async () => {
    if (!enabled || !incidentId || !userName) return;

    setStatus({ status: 'connecting', message: 'Requesting microphone access...' });

    try {
      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (stream) streamRef.current = stream;

      // 2. Connect WebSocket to transcription server if available
      const params = new URLSearchParams({ incidentId, userName, userRole });
      const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus({ status: 'connected', message: 'Connected to transcription server' });
        if (stream) {
          const audioContext = new AudioContext({ sampleRate: 16000 });
          audioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const inputData = e.inputBuffer.getChannelData(0);
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

            const int16 = new Int16Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
              const s = Math.max(-1, Math.min(1, audioData[i]));
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            ws.send(int16.buffer);
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transcript.partial' || msg.type === 'transcript.final') {
            const t = msg.transcript;
            if (!t) return;

            const segment: LiveTranscriptSegment = {
              id: t.id || `seg-${Date.now()}`,
              speaker: t.speakerName || userName,
              speakerName: t.speakerName || userName,
              role: t.speakerRole || userRole,
              text: t.text,
              timestamp: t.timestamp || new Date().toISOString(),
              isFinal: msg.type === 'transcript.final',
            };

            setSegments((prev) => {
              if (segment.isFinal) {
                sendTranscriptToBackend(segment.text, true);
                const filtered = prev.filter(
                  (s) => !(s.speaker === segment.speaker && !s.isFinal && segment.text.startsWith(s.text))
                );
                return [...filtered, segment];
              }
              const existingIdx = prev.findIndex((s) => s.id === segment.id);
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = segment;
                return updated;
              }
              return [...prev, segment];
            });
          }
        } catch {}
      };

      ws.onerror = () => {
        startWebSpeechFallback();
      };

      ws.onclose = () => {
        startWebSpeechFallback();
      };
    } catch {
      startWebSpeechFallback();
    }
  }, [incidentId, userName, userRole, enabled, sendTranscriptToBackend, startWebSpeechFallback]);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus({ status: 'idle' });
    setSegments([]);
  }, [cleanup]);

  useEffect(() => {
    if (!enabled || !incidentId || !userName) {
      disconnect();
      return;
    }
    connect();
    return () => {
      cleanup();
    };
  }, [incidentId, userName, userRole, enabled, connect, disconnect, cleanup]);

  return {
    status,
    segments,
    connect,
    disconnect,
  };
}
