'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useLiveTranscription, LiveTranscriptSegment } from '@/hooks/useLiveTranscription';
import { useAISpeaker } from '@/hooks/useAISpeaker';
import { useCommanderAgent } from '@/hooks/useCommanderAgent';
import { startAIVoiceParticipant, AI_PARTICIPANT_UID, AI_PARTICIPANT_NAME, AIVoiceParticipantHandle } from '@/lib/agoraAIVoiceParticipant';
import { AiUtteranceSummary } from '@/types/incident';
import AudioVisualizer from '@/components/AudioVisualizer';
import AppHeader from '@/components/landing/AppHeader';
import { Radio, Mic, MicOff, PhoneOff, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ActiveParticipant {
  uid: string;
  name: string;
  role: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
}

type PageProps = { params: Promise<{ id: string }> };

export default function VoiceRoom({ params }: PageProps) {
  const { id: incidentId } = use(params);

  const [incidentTitle, setIncidentTitle] = useState('Loading...');
  const [severity, setSeverity] = useState('SEV');
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  useEffect(() => {
    fetch(`/api/incidents/${incidentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setIncidentTitle(data.title || 'Unknown Incident');
          setSeverity(data.severity || 'SEV3');
          setPendingApprovalCount(
            Array.isArray(data.approvals) ? data.approvals.filter((a: { status: string }) => a.status === 'PENDING').length : 0
          );
        }
      })
      .catch(() => {});
  }, [incidentId]);

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting'>('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'ENGINEER' | 'SRE' | 'SUPPORT' | 'PRODUCT' | 'BUSINESS' | 'OBSERVER' | 'INCIDENT_COMMANDER'>('ENGINEER');
  const [participants, setParticipants] = useState<ActiveParticipant[]>([]);

  const agoraClientRef = useRef<{ leave: () => Promise<void> } | null>(null);
  const localAudioTrackRef = useRef<{ close: () => void; setEnabled: (v: boolean) => void } | null>(null);
  const aiVoiceRef = useRef<AIVoiceParticipantHandle | null>(null);

  const aiParticipant = useAISpeaker({
    incidentId,
    enabled: joined,
    onUtterance: (u: AiUtteranceSummary) => {
      if (aiVoiceRef.current) {
        aiVoiceRef.current.speak({ text: u.text, audioUrl: u.audioUrl }).catch(() => {});
      }
    },
  });

  const transcription = useLiveTranscription({ incidentId, userName: userName || 'Operator', userRole, enabled: joined });
  const commander = useCommanderAgent();
  const tokenDataRef = useRef<{ mock?: boolean; appId?: string; channelName?: string; token?: string; aiToken?: string; uid?: number; agentUid?: number } | null>(null);
  const [bridgeIsMock, setBridgeIsMock] = useState<boolean | null>(null);
  const [bridgeAgentUid, setBridgeAgentUid] = useState<number>(123456);

  const handleToggleCommander = useCallback(async () => {
    const td = tokenDataRef.current;
    if (!td || td.mock || !agoraClientRef.current) return;
    if (commander.state === 'running' || commander.state === 'connecting') {
      await commander.disconnectAgent();
      return;
    }
    if (commander.state === 'ending') return;
    try {
      await commander.connectAgent({
        incidentId,
        channelName: td.channelName!,
        token: td.token!,
        appId: td.appId!,
        requesterUid: td.uid!,
        agentUid: typeof td.agentUid === 'number' ? td.agentUid : 123456,
        rtcClient: agoraClientRef.current,
      });
    } catch (err) {
      console.warn('[CommanderAgent] toggle failed:', err);
    }
  }, [commander, incidentId]);

  const aiSegments: LiveTranscriptSegment[] = aiParticipant.utterances.map((u) => ({
    id: `ai-${u.id}`, speaker: AI_PARTICIPANT_NAME, speakerName: AI_PARTICIPANT_NAME,
    role: 'INCIDENT_COMMANDER', text: u.text, timestamp: u.createdAt, isFinal: true,
  }));

  const agentSegments: LiveTranscriptSegment[] = commander.entries.map((e) => ({
    id: `agent-${e.timestamp}-${e.uid}-${e.isFinal ? 'f' : 'p'}`,
    speaker: e.isAgent ? AI_PARTICIPANT_NAME : userName || 'Operator',
    speakerName: e.isAgent ? AI_PARTICIPANT_NAME : userName || 'Operator',
    role: e.isAgent ? 'INCIDENT_COMMANDER' : userRole,
    text: e.text, timestamp: new Date(e.timestamp).toISOString(), isFinal: e.isFinal,
  }));

  const crtSegments: LiveTranscriptSegment[] = [...aiSegments, ...agentSegments, ...transcription.segments].slice(0, 40);

  const startAIVoice = async (tokenData: { mock?: boolean; appId?: string; channelName?: string; token?: string; aiToken?: string }) => {
    if (aiVoiceRef.current) return;
    const sandbox = !!tokenData.mock || !tokenData.appId || !tokenData.channelName;
    aiVoiceRef.current = await startAIVoiceParticipant({
      appId: tokenData.appId || '', channelName: tokenData.channelName || '',
      token: tokenData.aiToken || tokenData.token || '', uid: AI_PARTICIPANT_UID, sandbox,
    });
  };

  const joinChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setConnecting(true);
    setErrorMsg(null);
    setConnectionStatus('Connecting');

    try {
      const tokenRes = await fetch(`/api/incidents/${incidentId}/agora-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, role: userRole }),
      }).catch(() => null);

      const tokenData = tokenRes && tokenRes.ok ? await tokenRes.json() : { mock: true };
      tokenDataRef.current = tokenData;
      setBridgeIsMock(!!tokenData.mock);
      if (typeof tokenData.agentUid === 'number') setBridgeAgentUid(tokenData.agentUid);

      if (!tokenData.mock && tokenData.appId) {
        const agoraModule = await import('agora-rtc-sdk-ng').catch(() => null);
        if (agoraModule) {
          const AgoraRTC = agoraModule.default;
          const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
          agoraClientRef.current = client;
          await client.join(tokenData.appId, tokenData.channelName, tokenData.token, tokenData.uid);
          const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = micTrack;
          await client.publish([micTrack]);
        }
      }

      setParticipants([
        { uid: 'local', name: userName, role: userRole, isMuted: false, isSpeaking: false, isLocal: true },
        { uid: String(AI_PARTICIPANT_UID), name: AI_PARTICIPANT_NAME, role: 'INCIDENT_COMMANDER', isMuted: false, isSpeaking: false, isLocal: false },
        { uid: 'p-1', name: 'Rahul Sharma', role: 'ENGINEER', isMuted: false, isSpeaking: true, isLocal: false },
        { uid: 'p-2', name: 'Priya Patel', role: 'SUPPORT', isMuted: false, isSpeaking: false, isLocal: false },
      ]);

      startAIVoice(tokenData).catch((err) => console.warn('[AIVoice] Failed:', err));
      setJoined(true);
      setConnectionStatus('Connected');
    } catch (err) {
      console.warn('Live Agora fallback:', err);
      setParticipants([
        { uid: 'local', name: userName, role: userRole, isMuted: false, isSpeaking: false, isLocal: true },
        { uid: String(AI_PARTICIPANT_UID), name: AI_PARTICIPANT_NAME, role: 'INCIDENT_COMMANDER', isMuted: false, isSpeaking: false, isLocal: false },
        { uid: 'p-1', name: 'Rahul Sharma', role: 'ENGINEER', isMuted: false, isSpeaking: true, isLocal: false },
        { uid: 'p-2', name: 'Priya Patel', role: 'SUPPORT', isMuted: false, isSpeaking: false, isLocal: false },
      ]);
      setJoined(true);
      setConnectionStatus('Connected');
    } finally {
      setConnecting(false);
    }
  };

  const leaveChannel = useCallback(async () => {
    try {
      await commander.disconnectAgent().catch(() => {});
      if (aiVoiceRef.current) { await aiVoiceRef.current.dispose(); aiVoiceRef.current = null; }
      if (localAudioTrackRef.current) localAudioTrackRef.current.close();
      if (agoraClientRef.current) await agoraClientRef.current.leave();
    } catch (err) { console.error(err); }
    setJoined(false);
    setConnectionStatus('Disconnected');
  }, [commander]);

  const toggleMute = () => {
    if (localAudioTrackRef.current) localAudioTrackRef.current.setEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  return (
    <div className="app-page font-sans flex flex-col">
      <AppHeader
        backHref={`/incidents/${incidentId}`}
        backLabel="Incident"
        title={incidentTitle}
        subtitle={`Voice room · ${severity}`}
      />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-8 flex flex-col justify-center">
        {errorMsg && (
          <div className="app-alert app-alert-error mb-6">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {errorMsg}
          </div>
        )}

        {pendingApprovalCount > 0 && (
          <Link
            href={`/incidents/${incidentId}`}
            className="app-alert app-alert-error mb-6 hover:opacity-90 transition-opacity"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">{pendingApprovalCount} action{pendingApprovalCount > 1 ? 's' : ''} waiting for approval</p>
              <p className="text-xs opacity-70 mt-0.5">Go to the incident page to review.</p>
            </div>
          </Link>
        )}

        {!joined ? (
          <div className="landing-card p-8 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Join the call</p>
              <h2 className="text-2xl font-bold">Connect to voice bridge</h2>
              <p className="text-sm text-white/50 mt-2">
                Enter your name and role to join the live incident call.
              </p>
            </div>

            <form onSubmit={joinChannel} className="space-y-4">
              <div>
                <label className="app-label">Your name *</label>
                <input type="text" required placeholder="e.g. Amit Kumar" value={userName}
                  onChange={(e) => setUserName(e.target.value)} disabled={connecting} className="app-input" />
              </div>
              <div>
                <label className="app-label">Your role</label>
                <select value={userRole} onChange={(e) => setUserRole(e.target.value as typeof userRole)}
                  disabled={connecting} className="app-input">
                  <option value="ENGINEER">Engineer</option>
                  <option value="SRE">SRE</option>
                  <option value="SUPPORT">Support</option>
                  <option value="PRODUCT">Product</option>
                  <option value="BUSINESS">Business</option>
                  <option value="INCIDENT_COMMANDER">Incident Commander</option>
                  <option value="OBSERVER">Observer</option>
                </select>
              </div>
              <button type="submit" disabled={connecting} className="w-full btn-landing-primary justify-center py-3.5 disabled:opacity-50">
                {connecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Join call
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="landing-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                <span className="text-sm text-white/60">{connectionStatus}</span>
              </div>
              <span className="text-xs text-[#33d1ff] font-medium">Live</span>
            </div>

            {/* AI Commander control */}
            <div className="p-4 rounded-xl bg-white/5 border border-[#33d1ff]/20 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#33d1ff]">AI Commander</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {bridgeIsMock ? 'Demo mode' :
                      commander.state === 'running' ? (commander.agentOnline ? commander.presence : 'Joining...') : 'Standby'}
                  </p>
                </div>
                <button
                  onClick={handleToggleCommander}
                  disabled={bridgeIsMock || commander.state === 'ending'}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                    commander.state === 'running'
                      ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                      : 'border-[#33d1ff]/50 text-[#33d1ff] hover:bg-[#33d1ff]/10'
                  }`}
                >
                  {commander.state === 'connecting' ? 'Joining...' :
                    commander.state === 'running' ? 'Disconnect AI' : 'Connect AI'}
                </button>
              </div>
              {commander.error && <p className="text-xs text-red-400">⚠ {commander.error}</p>}
              {commander.state === 'running' && !commander.error && (
                <p className="text-xs text-white/40">Agent joined on UID {bridgeAgentUid}. Speak to get AI replies.</p>
              )}
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <p className="app-section-title">In the call</p>
              {participants.map((p) => {
                const isAi = p.uid === String(AI_PARTICIPANT_UID);
                const isSpeaking = isAi ? !!aiParticipant.session?.speaking : p.isSpeaking;
                return (
                  <div key={p.uid} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        p.isLocal ? 'bg-[#33d1ff] text-black' : isAi ? 'bg-purple-500 text-white' : 'bg-white/10 text-white'
                      }`}>
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {p.name}
                          {isAi && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">AI</span>}
                          {p.isLocal && <span className="text-[10px] bg-[#33d1ff]/20 text-[#33d1ff] px-1.5 py-0.5 rounded-full">You</span>}
                        </p>
                        <p className="text-xs text-white/40">{p.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AudioVisualizer isSpeaking={isSpeaking} isMuted={p.isMuted} />
                      {isSpeaking ? (
                        <span className="text-[10px] text-green-400 font-medium">Speaking</span>
                      ) : p.isMuted ? (
                        <span className="text-[10px] text-red-400">Muted</span>
                      ) : (
                        <span className="text-[10px] text-white/30">Idle</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live transcript */}
            <div className="transcript-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#33d1ff] uppercase tracking-wider">Live transcript</p>
                <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{transcription.status.status}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {crtSegments.length === 0 && (
                  <p className="text-center text-xs text-white/30 py-4">Listening...</p>
                )}
                {crtSegments.map((t, i) => (
                  <LiveTranscriptBubble key={`${t.id}-${i}`} seg={t} />
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button onClick={toggleMute} className="flex-1 btn-landing-outline justify-center py-3">
                {isMuted ? <Mic className="w-4 h-4 text-green-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={leaveChannel} className="btn-landing-primary py-3 px-6">
                <PhoneOff className="w-4 h-4" />
                Leave
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LiveTranscriptBubble({ seg }: { seg: LiveTranscriptSegment }) {
  const time = new Date(seg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const isAI = seg.speakerName === AI_PARTICIPANT_NAME;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span className={isAI ? 'text-purple-400 font-medium' : ''}>{seg.speakerName || seg.speaker}</span>
        <span>{time}</span>
      </div>
      <div className={`p-2.5 rounded-lg text-xs leading-relaxed ${
        isAI ? 'bg-purple-500/10 border border-purple-500/20 text-purple-200' : 'bg-white/5 text-white/70'
      }`}>
        {seg.text}
        {!seg.isFinal && <span className="ml-1 text-[#33d1ff] animate-pulse">▍</span>}
      </div>
    </div>
  );
}
