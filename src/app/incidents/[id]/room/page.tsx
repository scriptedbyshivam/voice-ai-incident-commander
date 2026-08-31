'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useLiveTranscription, LiveTranscriptSegment } from '@/hooks/useLiveTranscription';
import AudioVisualizer from '@/components/AudioVisualizer';

interface ActiveParticipant {
  uid: string;
  name: string;
  role: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function VoiceRoom({ params }: PageProps) {
  const { id: incidentId } = use(params);

  // Incident states
  const [incidentTitle, setIncidentTitle] = useState('Payment API Outage');
  const [severity, setSeverity] = useState('SEV1');

  // Connection & audio state
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting'>('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dbMode, setDbMode] = useState<'LIVE' | 'SIMULATED'>('LIVE');

  // Identity selection states
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'ENGINEER' | 'SRE' | 'SUPPORT' | 'PRODUCT' | 'BUSINESS' | 'OBSERVER' | 'INCIDENT_COMMANDER'>('ENGINEER');

  // Participants list
  const [participants, setParticipants] = useState<ActiveParticipant[]>([]);

  // Agora references
  const agoraClientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);

  // Live transcription
  const transcription = useLiveTranscription({
    incidentId,
    userName,
    userRole,
    enabled: joined && !isMuted,
  });

  // Ref to always access latest transcription disconnect without adding it to useCallback deps
  const transcriptionRef = useRef(transcription);
  useEffect(() => {
    transcriptionRef.current = transcription;
  });

  // Fetch core incident details on mount
  useEffect(() => {
    async function fetchIncident() {
      try {
        const res = await fetch(`/api/incidents/${incidentId}`);
        if (res.ok) {
          const data = await res.json();
          setIncidentTitle(data.title || data.incidentId);
          setSeverity(data.severity || 'SEV1');
        }
      } catch (err) {
        console.warn('Failed to load incident details in voice room:', err);
      }
    }
    fetchIncident();
  }, [incidentId]);

  // Speaking simulation for simulated voice room
  useEffect(() => {
    if (!joined || dbMode !== 'SIMULATED') return;

    const timer = setInterval(() => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.isLocal) return p;
          // Randomly simulate speaker activity for Remote participant Priya
          if (p.name === 'Priya Patel') {
            const isSpeaking = Math.random() > 0.5;
            return { ...p, isSpeaking, isMuted: false };
          }
          return p;
        })
      );
    }, 3000);

    return () => clearInterval(timer);
  }, [joined, dbMode]);


  // Connect to voice channel
  const joinChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    setConnecting(true);
    setErrorMsg(null);
    setConnectionStatus('Connecting');

    const uid = `${userName.trim()}|${userRole}`;

    try {
      // 1. Obtain token from secure server-side API endpoint
      const tokenUrl = `/api/agora/token?userId=${encodeURIComponent(uid)}&channelName=${incidentId}&incidentId=${incidentId}`;
      const tokenRes = await fetch(tokenUrl);
      if (!tokenRes.ok) {
        throw new Error('Failed to retrieve Agora authentication token.');
      }
      const tokenData = await tokenRes.json();

      // 2. Register participant in the database persistence layer
      await fetch(`/api/incidents/${incidentId}/participants/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName.trim(), role: userRole }),
      });

      // Check if we have a valid Agora App ID (32-character hex token)
      const isMockAppId = !tokenData.appId || tokenData.appId === 'mock_agora_app_id' || tokenData.appId.length !== 32;

      if (isMockAppId) {
        setDbMode('SIMULATED');
        setParticipants([
          { uid, name: userName.trim(), role: userRole, isMuted: false, isSpeaking: false, isLocal: true },
          { uid: 'priya|SUPPORT', name: 'Priya Patel', role: 'SUPPORT', isMuted: false, isSpeaking: false, isLocal: false },
          { uid: 'amit|SRE', name: 'Amit Kumar', role: 'SRE', isMuted: true, isSpeaking: false, isLocal: false },
        ]);
        setJoined(true);
        setConnectionStatus('Connected');
        return;
      }

      setDbMode('LIVE');

      // 3. Dynamically import Agora Web SDK (prevents server-side crash during npm run build)
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      // Initialize the Agora client
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      agoraClientRef.current = client;

      // Enable volume indicator to track who is speaking
      client.enableAudioVolumeIndicator();

      // Setup Agora Client Listeners
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack?.play();
          
          // Update active participant list
          const [remoteName, remoteRole] = user.uid.toString().split('|');
          setParticipants((prev) => {
            const exists = prev.some((p) => p.uid === user.uid);
            if (exists) {
              return prev.map((p) => (p.uid === user.uid ? { ...p, isMuted: false } : p));
            } else {
              return [...prev, { uid: user.uid.toString(), name: remoteName || 'User', role: remoteRole || 'SRE', isMuted: false, isSpeaking: false, isLocal: false }];
            }
          });
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'audio') {
          setParticipants((prev) =>
            prev.map((p) => (p.uid === user.uid ? { ...p, isMuted: true, isSpeaking: false } : p))
          );
        }
      });

      client.on('user-joined', (user) => {
        const [remoteName, remoteRole] = user.uid.toString().split('|');
        setParticipants((prev) => {
          const exists = prev.some((p) => p.uid === user.uid);
          if (exists) return prev;
          return [...prev, { uid: user.uid.toString(), name: remoteName || 'User', role: remoteRole || 'SRE', isMuted: true, isSpeaking: false, isLocal: false }];
        });
      });

      client.on('user-left', (user) => {
        setParticipants((prev) => prev.filter((p) => p.uid !== user.uid));
      });

      client.on('volume-indicator', (volumes) => {
        volumes.forEach((vol) => {
          const isSpeaking = vol.level > 5;
          setParticipants((prev) =>
            prev.map((p) => (p.uid === vol.uid.toString() ? { ...p, isSpeaking } : p))
          );
        });
      });

      client.on('connection-state-change', (curState) => {
        if (curState === 'CONNECTED') setConnectionStatus('Connected');
        if (curState === 'RECONNECTING') setConnectionStatus('Reconnecting');
        if (curState === 'DISCONNECTED') setConnectionStatus('Disconnected');
      });

      // 4. Join Agora channel
      await client.join(tokenData.appId, tokenData.channelName, tokenData.token, uid);

      // 5. Create local audio track (enable mic)
      let localAudioTrack;
      try {
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localAudioTrackRef.current = localAudioTrack;
      } catch (micErr: any) {
        if (micErr.code === 'PERMISSION_DENIED') {
          throw new Error('Microphone permission denied. Please allow microphone access to participate.');
        } else if (micErr.code === 'DEVICE_NOT_FOUND') {
          throw new Error('Microphone unavailable. Ensure you have a functioning recording device plugged in.');
        } else {
          throw new Error('Failed to acquire microphone track: ' + micErr.message);
        }
      }

      // Publish local track to room
      await client.publish([localAudioTrack]);

      // 6. Start live transcription from the local microphone stream
      try {
        const mediaTrack: MediaStreamTrack = localAudioTrack.getMediaStreamTrack();
        const stream = new MediaStream([mediaTrack]);
        transcription.connect(stream);
      } catch (sttErr) {
        console.warn('[STT] Could not start live transcription:', sttErr);
      }

      // Set local user details in participant list (merge, don't overwrite remotes)
      setParticipants((prev) => {
        const withoutLocal = prev.filter((p) => !p.isLocal);
        return [
          { uid, name: userName.trim(), role: userRole, isMuted: false, isSpeaking: false, isLocal: true },
          ...withoutLocal,
        ];
      });

      setJoined(true);
      setConnectionStatus('Connected');
    } catch (err: any) {
      console.error('Error connecting to voice room:', err);
      setErrorMsg(err.message || 'Connection failure. Please check your credentials and retry.');
      setConnectionStatus('Disconnected');
      leaveChannel();
    } finally {
      setConnecting(false);
    }
  };

  // Mute/Unmute microphone
  const toggleMute = async () => {
    const nextMuted = !isMuted;
    if (localAudioTrackRef.current) {
      try {
        await localAudioTrackRef.current.setEnabled(!nextMuted);
      } catch (err) {
        console.error('Failed to toggle mic track:', err);
      }
    }
    setIsMuted(nextMuted);
    
    const localUid = `${userName.trim()}|${userRole}`;
    setParticipants((prev) =>
      prev.map((p) => (p.uid === localUid ? { ...p, isMuted: nextMuted, isSpeaking: false } : p))
    );
  };

  // Leave Voice Room
  const leaveChannel = useCallback(async () => {
    setConnectionStatus('Disconnected');
    setJoined(false);
    setParticipants([]);

    // stop live transcription
    transcriptionRef.current.disconnect();

    // 1. Notify DB persistence layer
    if (userName.trim()) {
      try {
        await fetch(`/api/incidents/${incidentId}/participants/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userName.trim() }), // UUID is preferred, fallback name-based key
        }).catch(err => console.warn('Could not post leave event to database:', err));
      } catch (err) {
        console.warn(err);
      }
    }

    // 2. Close local track
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }

    // 3. Leave Agora channel
    if (agoraClientRef.current) {
      try {
        await agoraClientRef.current.leave();
      } catch (err) {
        console.warn('Failed to leave Agora client:', err);
      }
      agoraClientRef.current = null;
    }
  }, [incidentId, userName]);

  // Clean up Agora connection on unmount
  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, [leaveChannel]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 flex flex-col relative">
      {/* Glow Effects */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-indigo-650/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded bg-gradient-to-tr from-indigo-650 to-indigo-400 flex items-center justify-center font-bold text-lg text-white">
              🎙️
            </span>
            <div>
              <span className="text-[10px] text-indigo-400 uppercase font-black tracking-wider block">Live Voice Bridge</span>
              <h1 className="text-sm font-bold text-white leading-none mt-0.5">{incidentTitle}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="bg-rose-950/80 text-rose-350 border border-rose-900 px-2.5 py-1 rounded text-xs font-bold">
              {severity}
            </span>
            <Link 
              href={`/incidents/${incidentId}`}
              className="text-xs font-bold text-slate-450 hover:text-white transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        
        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-rose-950/30 border border-rose-900/60 text-rose-300 text-xs leading-relaxed flex gap-2">
            <span>⚠️</span>
            <div>{errorMsg}</div>
          </div>
        )}

        {!joined ? (
          // Pre-Join Join Panel
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-indigo-400" />
            
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Connect Voice Bridge</h2>
              <p className="text-xs text-slate-450">Join the live operational voice call channel to triage this outage incident.</p>
            </div>

            <form onSubmit={joinChannel} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Kumar"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  disabled={connecting}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-xs text-white placeholder-slate-655"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Your On-Call Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  disabled={connecting}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-xs text-white"
                >
                  <option value="ENGINEER">ENGINEER (Triage development)</option>
                  <option value="SRE">SRE (Platform infrastructure)</option>
                  <option value="SUPPORT">SUPPORT (Customer backlog queues)</option>
                  <option value="PRODUCT">PRODUCT (Scope alignment)</option>
                  <option value="BUSINESS">BUSINESS (Revenue impact)</option>
                  <option value="INCIDENT_COMMANDER">INCIDENT COMMANDER (Decisions & approvals)</option>
                  <option value="OBSERVER">OBSERVER (Passive listener)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={connecting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-550 disabled:bg-indigo-850 disabled:text-slate-400 font-bold text-xs text-white rounded-lg shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition-all"
              >
                {connecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Requesting Secure Token...
                  </>
                ) : (
                  'Connect microphone'
                )}
              </button>
            </form>
          </div>
        ) : (
          // Active Voice Room Panel
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl relative">
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'Connected' ? 'bg-emerald-500' :
                connectionStatus === 'Connecting' || connectionStatus === 'Reconnecting' ? 'bg-amber-500 animate-ping' :
                'bg-slate-700'
              }`} />
              <span className="text-[9px] uppercase font-bold text-slate-500">{connectionStatus}</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-white">Active Bridge Participants</h2>
              <p className="text-xs text-slate-450">Triage bridge is open. All audio tracks are live-mixed.</p>
            </div>

            {/* Participants list */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 divide-y divide-slate-850/50 space-y-2.5">
              {participants.map((p) => (
                <div key={p.uid} className="flex items-center justify-between pt-2.5 first:pt-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${p.isLocal ? 'bg-indigo-650' : 'bg-slate-805'}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {p.isLocal && <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-900 px-1 rounded">You</span>}
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-500">{p.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <AudioVisualizer isSpeaking={p.isSpeaking} isMuted={p.isMuted} />
                    {/* Speak Indicator */}
                    {p.isSpeaking ? (
                      <span className="text-[9px] uppercase font-bold text-emerald-450 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60 animate-pulse">
                        Speaking 🎙️
                      </span>
                    ) : p.isMuted ? (
                      <span className="text-[9px] uppercase font-bold text-rose-350 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/40">
                        Muted 🔇
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold text-slate-500">
                        Silent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Transcript */}
            <div className="rounded-xl border border-slate-850 bg-slate-950 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-850 bg-slate-900/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">LIVE TRANSCRIPT</span>
                <span
                  className={`text-[9px] font-bold uppercase rounded px-1.5 py-0.5 ${
                    transcription.status.status === 'connected'
                      ? 'bg-emerald-950 text-emerald-400'
                      : transcription.status.status === 'mock'
                      ? 'bg-amber-950 text-amber-400'
                      : transcription.status.status === 'error'
                      ? 'bg-rose-950 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {transcription.status.status}
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto p-3 space-y-2.5">
                {transcription.status.status === 'error' && (
                  <div className="p-2.5 rounded bg-rose-950/30 border border-rose-900/40 text-[10px] text-rose-300 leading-relaxed">
                    ⚠️ {transcription.status.message || 'STT unavailable. Voice room continues without transcription.'}
                  </div>
                )}
                {transcription.segments.length === 0 && transcription.status.status === 'connected' && (
                  <div className="text-center text-[10px] text-slate-500 py-4">
                    Listening… speak to see live transcription.
                  </div>
                )}
                {transcription.segments.length === 0 && transcription.status.status !== 'connected' && (
                  <div className="text-center text-[10px] text-slate-600 py-4">
                    No live transcript yet.
                  </div>
                )}
                {transcription.segments.map((t, i) => (
                  <LiveTranscriptBubble key={`${t.id}-${i}`} seg={t} />
                ))}
              </div>
            </div>

            {/* Action buttons panel */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={toggleMute}
                className={`flex-1 py-3 font-bold text-xs rounded-lg border transition-all flex items-center justify-center gap-2 ${
                  isMuted
                    ? 'bg-rose-950/20 text-rose-450 border-rose-800 hover:bg-rose-900/30'
                    : 'bg-slate-850 text-slate-300 border-slate-750 hover:bg-slate-800'
                }`}
              >
                {isMuted ? '🎙️ Unmute Mic' : '🔇 Mute Mic'}
              </button>

              <button
                onClick={leaveChannel}
                className="py-3 px-6 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-lg shadow transition-all"
              >
                Leave Bridge
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LiveTranscriptBubble({ seg }: { seg: LiveTranscriptSegment }) {
  const time = new Date(seg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[9px] text-slate-500">
        <span className="font-bold uppercase">{seg.speakerName}</span>
        <span>{time}</span>
      </div>
      <div
        className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
          seg.isFinal
            ? 'bg-slate-900 border-slate-850 text-slate-200'
            : 'bg-slate-900/40 border-slate-800/60 text-slate-400 italic'
        }`}
      >
        {seg.text}
        {!seg.isFinal && <span className="ml-1 text-indigo-400">▍</span>}
      </div>
    </div>
  );
}
