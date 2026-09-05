'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useLiveTranscription, LiveTranscriptSegment } from '@/hooks/useLiveTranscription';
import { useAISpeaker } from '@/hooks/useAISpeaker';
import { useCommanderAgent } from '@/hooks/useCommanderAgent';
import { startAIVoiceParticipant, AI_PARTICIPANT_UID, AI_PARTICIPANT_NAME, AIVoiceParticipantHandle } from '@/lib/agoraAIVoiceParticipant';
import { AiUtteranceSummary, IncidentState } from '@/types/incident';
import {
  Mic, MicOff, PhoneOff, Subtitles, Hand,
  Users, Sparkles, ShieldAlert, X,
  ArrowLeft, Bot, FileText, CheckCircle2, AlertTriangle, Download, ArrowRight,
  Flame, Clock, Volume2, VolumeX
} from 'lucide-react';

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

  // Incident State
  const [incidentTitle, setIncidentTitle] = useState('Loading...');
  const [severity, setSeverity] = useState('SEV3');
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  // Voice Room Connection State
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting'>('Disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [aiVoiceMuted, setAiVoiceMuted] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSideDrawer, setActiveSideDrawer] = useState<'captions' | 'people' | null>('captions');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Meeting Summary Modal State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState<IncidentState | null>(null);

  // User details
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'ENGINEER' | 'SRE' | 'SUPPORT' | 'PRODUCT' | 'BUSINESS' | 'OBSERVER' | 'INCIDENT_COMMANDER'>('ENGINEER');
  const [participants, setParticipants] = useState<ActiveParticipant[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadIncidentData = useCallback(async () => {
    try {
      const r = await fetch(`/api/incidents/${incidentId}`);
      if (r.ok) {
        const data = await r.json();
        setIncidentTitle(data.title || 'Unknown Incident');
        setSeverity(data.severity || 'SEV3');
        setPendingApprovalCount(
          Array.isArray(data.approvals) ? data.approvals.filter((a: { status: string }) => a.status === 'PENDING').length : 0
        );
        setSummaryData(data);
      }
    } catch {}
  }, [incidentId]);

  useEffect(() => {
    loadIncidentData();
  }, [loadIncidentData]);

  const agoraClientRef = useRef<{ leave: () => Promise<void> } | null>(null);
  const localAudioTrackRef = useRef<{ close: () => void; setMuted: (muted: boolean) => Promise<void> } | null>(null);
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

  // Transcription is ALWAYS active when joined (browser speech fallback included)
  const transcription = useLiveTranscription({
    incidentId,
    userName: userName || 'Operator',
    userRole,
    enabled: joined,
    muted: isMuted,
  });

  const commander = useCommanderAgent();
  const tokenDataRef = useRef<{ mock?: boolean; appId?: string; channelName?: string; token?: string; aiToken?: string; aiUid?: number; uid?: number | string; agentUid?: number; commanderRtmUid?: string; commanderRtmToken?: string } | null>(null);
  const [bridgeIsMock, setBridgeIsMock] = useState<boolean | null>(null);
  const [bridgeAgentUid, setBridgeAgentUid] = useState<number>(123456);

  const handleToggleCommander = useCallback(async () => {
    const td = tokenDataRef.current;
    if (!td || td.mock) {
      setErrorMsg('AI Commander requires a live Agora connection (not available in demo mode).');
      return;
    }
    if (commander.state === 'running' || commander.state === 'connecting') {
      await commander.disconnectAgent();
      return;
    }
    if (commander.state === 'ending') return;
    if (!agoraClientRef.current) {
      setErrorMsg('Voice channel not connected. Rejoin the room to enable AI Commander.');
      return;
    }
    try {
      await commander.connectAgent({
        incidentId,
        channelName: td.channelName!,
        token: td.token!,
        appId: td.appId!,
        requesterUid: String(td.uid!),
        agentUid: typeof td.agentUid === 'number' ? td.agentUid : 123456,
        rtcClient: agoraClientRef.current,
        rtmUid: td.commanderRtmUid || undefined,
        rtmToken: td.commanderRtmToken || undefined,
        aiVoiceUidToSkip: typeof td.aiUid === 'number' ? td.aiUid : AI_PARTICIPANT_UID,
      });
    } catch (err) {
      console.warn('[CommanderAgent] toggle failed:', err);
      setErrorMsg('AI Commander failed to connect. Check server logs.');
    }
  }, [commander, incidentId]);

  // Cleanup on unmount: release mic + leave Agora channel if user navigated away
  useEffect(() => {
    return () => {
      if (localAudioTrackRef.current) {
        try { localAudioTrackRef.current.close(); } catch {}
        localAudioTrackRef.current = null;
      }
      if (agoraClientRef.current) {
        agoraClientRef.current.leave().catch(() => {});
        agoraClientRef.current = null;
      }
      if (aiVoiceRef.current) {
        aiVoiceRef.current.dispose().catch(() => {});
        aiVoiceRef.current = null;
      }
    };
  }, []);

  const aiSegments: LiveTranscriptSegment[] = aiParticipant.utterances.map((u) => ({
    id: `ai-${u.id}`, speaker: AI_PARTICIPANT_NAME, speakerName: AI_PARTICIPANT_NAME,
    role: 'INCIDENT_COMMANDER', text: u.text, timestamp: u.createdAt, isFinal: true,
  }));

  const agentSegments: LiveTranscriptSegment[] = commander.entries.map((e) => ({
    id: `agent-${e.timestamp}-${String(e.uid)}-${e.isFinal ? 'f' : 'p'}`,
    speaker: e.isAgent ? AI_PARTICIPANT_NAME : userName || 'Operator',
    speakerName: e.isAgent ? AI_PARTICIPANT_NAME : userName || 'Operator',
    role: e.isAgent ? 'INCIDENT_COMMANDER' : userRole,
    text: e.text, timestamp: new Date(e.timestamp).toISOString(), isFinal: e.isFinal,
  }));

  // Surface the Commander's own connection error (RTM/agent) to the user —
  // otherwise `commander.state === 'error'` fails silently with no feedback.
  const commanderError = commander.state === 'error' ? commander.error : null;

  const crtSegments: LiveTranscriptSegment[] = [...aiSegments, ...agentSegments, ...transcription.segments].slice(0, 50);

  const startAIVoice = async (tokenData: { mock?: boolean; appId?: string; channelName?: string; token?: string; aiToken?: string; aiUid?: number }) => {
    if (aiVoiceRef.current) return;
    const sandbox = !!tokenData.mock || !tokenData.appId || !tokenData.channelName;
    aiVoiceRef.current = await startAIVoiceParticipant({
      appId: tokenData.appId || '', channelName: tokenData.channelName || '',
      token: tokenData.aiToken || tokenData.token || '',
      uid: tokenData.aiUid ?? AI_PARTICIPANT_UID, sandbox,
    });
  };

  const joinChannel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const displayName = userName.trim() || 'Operator';
    setUserName(displayName);
    setConnecting(true);
    setErrorMsg(null);
    setConnectionStatus('Connecting');

    try {
      const tokenRes = await fetch(`/api/incidents/${incidentId}/agora-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName, role: userRole }),
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
          if (isMuted) await micTrack.setMuted(true);
          await client.publish([micTrack]);
        }
      }

      setParticipants([
        { uid: String(AI_PARTICIPANT_UID), name: AI_PARTICIPANT_NAME, role: 'AI Commander', isMuted: false, isSpeaking: true, isLocal: false },
        { uid: 'local', name: `${displayName} (You)`, role: userRole, isMuted: false, isSpeaking: false, isLocal: true },
        { uid: 'p-1', name: 'Rahul Sharma', role: 'ENGINEER', isMuted: false, isSpeaking: false, isLocal: false },
        { uid: 'p-2', name: 'Priya Patel', role: 'SUPPORT Lead', isMuted: true, isSpeaking: false, isLocal: false },
      ]);

      startAIVoice(tokenData).catch((err) => console.warn('[AIVoice] Failed:', err));
      setJoined(true);
      setConnectionStatus('Connected');
    } catch (err) {
      console.warn('Live Agora fallback:', err);
      setParticipants([
        { uid: String(AI_PARTICIPANT_UID), name: AI_PARTICIPANT_NAME, role: 'AI Commander', isMuted: false, isSpeaking: true, isLocal: false },
        { uid: 'local', name: `${displayName} (You)`, role: userRole, isMuted: false, isSpeaking: false, isLocal: true },
        { uid: 'p-1', name: 'Rahul Sharma', role: 'ENGINEER', isMuted: false, isSpeaking: false, isLocal: false },
        { uid: 'p-2', name: 'Priya Patel', role: 'SUPPORT Lead', isMuted: true, isSpeaking: false, isLocal: false },
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

    // Trigger analysis update and show meeting summary modal
    await loadIncidentData();
    setShowSummaryModal(true);
  }, [commander, loadIncidentData]);

  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, isMuted: nextMuted } : p))
    );
    if (localAudioTrackRef.current) {
      await localAudioTrackRef.current.setMuted(nextMuted).catch(() => {});
    }
  };

  const toggleAIVoiceMute = () => {
    const next = !aiVoiceMuted;
    setAiVoiceMuted(next);
    if (aiVoiceRef.current) aiVoiceRef.current.setMuted(next);
    commander.setAgentMuted(next);
  };

  // Google Meet Pre-join Screen
  if (!joined && !showSummaryModal) {
    return (
      <div className="gmeet-bg min-h-screen font-sans flex flex-col justify-between p-6">
        {/* Top Navbar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/incidents/${incidentId}`} className="text-white/60 hover:text-white flex items-center gap-1 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Incident</span>
            </Link>
            <span className="text-white/20">|</span>
            <span className="font-medium text-sm text-white/80 truncate max-w-sm">{incidentTitle}</span>
          </div>
          <div className="text-xs text-white/50">{currentTime}</div>
        </header>

        {/* Pre-join Card Container */}
        <main className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-12">
          {/* Left Preview Box */}
          <div className="md:col-span-7 gmeet-tile p-8 flex flex-col items-center justify-center min-h-[320px] relative overflow-hidden shadow-2xl border border-white/10">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4">
              {userName ? userName.charAt(0).toUpperCase() : 'O'}
            </div>
            <p className="text-lg font-medium text-white">{userName || 'Operator'}</p>
            <p className="text-xs text-white/50 mt-1">Microphone ready</p>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`gmeet-btn-icon ${isMuted ? 'gmeet-btn-danger' : ''}`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Right Form Box */}
          <div className="md:col-span-5 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Ready to join?</h2>
              <p className="text-sm text-white/60 mt-1">
                Enter your details to join the live incident voice room with AI Incident Commander.
              </p>
            </div>

            <form onSubmit={joinChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Your Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operator"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-[#202124] border border-white/20 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#8ab4f8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Operational Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as typeof userRole)}
                  className="w-full bg-[#202124] border border-white/20 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#8ab4f8]"
                >
                  <option value="ENGINEER">Engineer</option>
                  <option value="SRE">SRE Lead</option>
                  <option value="SUPPORT">Support</option>
                  <option value="INCIDENT_COMMANDER">Incident Commander</option>
                  <option value="OBSERVER">Observer</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={connecting}
                className="w-full bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124] font-semibold py-3.5 rounded-full transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#202124] border-t-transparent rounded-full animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <span>Join now</span>
                )}
              </button>
            </form>
          </div>
        </main>

        <footer className="text-center text-xs text-white/40">
          Powered by Agora RTC &amp; AI Incident Commander Bridge
        </footer>
      </div>
    );
  }

  // Active Google Meet Voice Room View
  return (
    <div className="gmeet-bg h-screen w-screen font-sans flex flex-col justify-between overflow-hidden relative select-none">
      {/* Top Header Bar */}
      <header className="px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href={`/incidents/${incidentId}`} className="hover:opacity-80 transition-opacity">
            <span className="text-xl font-bold tracking-tight text-white">Incident Bridge</span>
          </Link>
          <span className="text-white/30 text-sm">|</span>
          <span className="text-sm font-medium text-white/90 truncate max-w-xs">{incidentTitle}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${severity === 'SEV1' ? 'bg-red-500 text-white' : severity === 'SEV2' ? 'bg-amber-500 text-white' : 'bg-white/20 text-white'}`}>
            {severity}
          </span>
        </div>

        {/* Top Right Status & Approval Notice */}
        <div className="flex items-center gap-4">
          {pendingApprovalCount > 0 && (
            <Link
              href={`/incidents/${incidentId}`}
              className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-300 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-red-500/30 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{pendingApprovalCount} Action Pending</span>
            </Link>
          )}

          <div className="text-xs text-white/60 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>{currentTime}</span>
          </div>
        </div>
      </header>

      {/* Error Toast */}
      {(errorMsg || commanderError) && (
        <div className="mx-6 mb-2 flex items-center justify-between bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-2 rounded-xl text-xs font-medium z-20">
          <span>{errorMsg || commanderError}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-3 text-red-400 hover:text-red-200">&times;</button>
        </div>
      )}

      {/* Main Grid + Slide-in Sidebar Stage */}
      <div className="flex-1 flex overflow-hidden px-6 pb-20 relative">
        {/* Main Participant Tile Grid (Google Meet Grid) */}
        <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 items-center justify-center p-2">
          {participants.map((p) => {
            const isAi = p.uid === String(AI_PARTICIPANT_UID);
            const isSpeaking = isAi ? !!aiParticipant.session?.speaking : p.isSpeaking;
            const showMuted = isAi ? aiVoiceMuted : p.isMuted;

            return (
              <div
                key={p.uid}
                className="gmeet-tile h-full w-full flex flex-col items-center justify-center relative overflow-hidden p-6 border border-white/5 shadow-xl group"
              >
                {/* Center Avatar */}
                <div className={`w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold transition-all relative ${
                  isAi
                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-500/30 shadow-2xl'
                    : p.isLocal
                    ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white'
                    : 'bg-[#5f6368] text-white'
                } ${isSpeaking ? 'gmeet-speaking-ring' : ''}`}>
                  {isAi ? (
                    <Bot className="w-12 h-12 text-white animate-pulse" />
                  ) : (
                    <span>{p.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Bottom Left Participant Label */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/10 text-xs text-white font-medium">
                  {isAi && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                  <span>{p.name}</span>
                </div>

                {/* Bottom Right Mic Status Badge */}
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10">
                  {showMuted ? (
                    <MicOff className="w-4 h-4 text-red-400" />
                  ) : (
                    <Mic className="w-4 h-4 text-green-400" />
                  )}
                </div>
              </div>
            );
          })}
        </main>

        {/* Right Side Drawer (Live Transcript CC or People) */}
        {activeSideDrawer && (
          <aside className="w-96 gmeet-tile ml-4 flex flex-col border border-white/10 shadow-2xl overflow-hidden my-2">
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#202124]">
              <div className="flex items-center gap-4 text-xs font-semibold">
                <button
                  onClick={() => setActiveSideDrawer('captions')}
                  className={`pb-1 border-b-2 transition-colors ${activeSideDrawer === 'captions' ? 'border-[#8ab4f8] text-[#8ab4f8]' : 'border-transparent text-white/60 hover:text-white'}`}
                >
                  Live Transcript (CC)
                </button>
                <button
                  onClick={() => setActiveSideDrawer('people')}
                  className={`pb-1 border-b-2 transition-colors ${activeSideDrawer === 'people' ? 'border-[#8ab4f8] text-[#8ab4f8]' : 'border-transparent text-white/60 hover:text-white'}`}
                >
                  People ({participants.length})
                </button>
              </div>

              <button
                onClick={() => setActiveSideDrawer(null)}
                className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
              {activeSideDrawer === 'captions' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-white/40 pb-2 border-b border-white/5">
                    <span>SPEECH STREAM</span>
                    <span className="text-[#8ab4f8]">{transcription.status.status}</span>
                  </div>

                  {crtSegments.length === 0 && (
                    <p className="text-center text-white/30 py-8 italic font-sans text-xs">
                      Listening to ongoing voice conversation...
                    </p>
                  )}

                  {crtSegments.map((seg, idx) => (
                    <div key={`${seg.id}-${idx}`} className="p-3 rounded-lg bg-[#28292c] text-white/90 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={seg.speakerName === AI_PARTICIPANT_NAME ? 'text-purple-400 font-bold' : 'text-[#8ab4f8] font-medium'}>
                          {seg.speakerName || seg.speaker}
                        </span>
                        <span className="text-white/40">
                          {new Date(seg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="leading-relaxed font-sans text-xs text-white/80">{seg.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 font-sans">
                  {participants.map((p) => (
                    <div key={p.uid} className="flex items-center justify-between p-3 rounded-lg bg-[#28292c]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#5f6368] flex items-center justify-center text-xs font-bold text-white">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">{p.name}</p>
                          <p className="text-[10px] text-white/40">{p.role}</p>
                        </div>
                      </div>
                      <div>
                        {p.uid === String(AI_PARTICIPANT_UID) ? (
                          aiVoiceMuted ? (
                            <MicOff className="w-4 h-4 text-red-400" />
                          ) : (
                            <Mic className="w-4 h-4 text-green-400" />
                          )
                        ) : p.isMuted ? (
                          <MicOff className="w-4 h-4 text-red-400" />
                        ) : (
                          <Mic className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Floating Google Meet Bottom Control Toolbar */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 gmeet-toolbar px-6 py-3 rounded-full flex items-center gap-3 sm:gap-4 shadow-2xl">
        {/* Mute Mic */}
        <button
          onClick={toggleMute}
          className={`gmeet-btn-icon ${isMuted ? 'gmeet-btn-danger' : ''}`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Captions / CC */}
        <button
          onClick={() => setActiveSideDrawer(activeSideDrawer === 'captions' ? null : 'captions')}
          className={`gmeet-btn-icon ${activeSideDrawer === 'captions' ? 'gmeet-btn-active' : ''}`}
          title="Turn on captions"
        >
          <Subtitles className="w-5 h-5" />
        </button>

        {/* Raise Hand */}
        <button
          onClick={() => setIsHandRaised(!isHandRaised)}
          className={`gmeet-btn-icon ${isHandRaised ? 'gmeet-btn-active' : ''}`}
          title="Raise hand"
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* AI Incident Commander Assistant */}
        <button
          onClick={handleToggleCommander}
          disabled={commander.state === 'ending' || commander.state === 'connecting'}
          className={`gmeet-btn-icon disabled:opacity-40 ${commander.state === 'running' ? 'gmeet-btn-[#8ab4f8] text-[#8ab4f8] border border-[#8ab4f8]' : ''}`}
          title="AI Incident Commander Assistant"
        >
          <Sparkles className={`w-5 h-5 ${commander.state === 'running' ? 'animate-spin text-[#8ab4f8]' : ''}`} />
        </button>

        {/* Mute / Unmute the AI's voice */}
        <button
          onClick={toggleAIVoiceMute}
          className={`gmeet-btn-icon ${aiVoiceMuted ? 'gmeet-btn-danger' : ''}`}
          title={aiVoiceMuted ? 'Unmute AI voice' : 'Mute AI voice'}
        >
          {aiVoiceMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* People / Participants List */}
        <button
          onClick={() => setActiveSideDrawer(activeSideDrawer === 'people' ? null : 'people')}
          className={`gmeet-btn-icon ${activeSideDrawer === 'people' ? 'gmeet-btn-active' : ''}`}
          title="People"
        >
          <Users className="w-5 h-5" />
        </button>

        {/* End Call Red Button */}
        <button
          onClick={leaveChannel}
          className="bg-[#ea4335] hover:bg-[#d93025] text-white px-5 py-2.5 rounded-full flex items-center gap-2 font-medium text-xs shadow-lg transition-transform hover:scale-105"
          title="Leave call"
        >
          <PhoneOff className="w-5 h-5 fill-white stroke-[2]" />
          <span className="font-semibold text-xs tracking-wide">Leave call</span>
        </button>
      </footer>

      {/* Post-Call Meeting Summary Modal (Auto-Triggered on Leave Call) */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="landing-card max-w-2xl w-full p-6 sm:p-8 space-y-6 border border-white/20 bg-[#0e1018] shadow-2xl rounded-3xl animate-fade-up max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Call Ended — Meeting Summary</h3>
                  <p className="text-xs text-white/50">Incident bridge session auto-summarized &amp; updated</p>
                </div>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Incident Summary Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{incidentTitle}</span>
                <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                  {severity}
                </span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                {summaryData?.description || 'Voice bridge triage completed. All speech transcriptions parsed and persisted.'}
              </p>
            </div>

            {/* Key Takeaways & Extracted Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Confirmed Facts */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  Confirmed Facts ({summaryData?.confirmedFacts.length || 0})
                </p>
                {summaryData?.confirmedFacts.slice(0, 3).map((f) => (
                  <p key={f.id} className="text-white/70 leading-normal font-sans">
                    • {f.title}
                  </p>
                )) || <p className="text-white/30 italic">No facts logged.</p>}
              </div>

              {/* Action Items */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Action Items ({summaryData?.actions.length || 0})
                </p>
                {summaryData?.actions.slice(0, 3).map((a) => (
                  <p key={a.id} className="text-white/70 leading-normal font-sans">
                    • {a.title} ({a.assigneeName || 'Assigned'})
                  </p>
                )) || <p className="text-white/30 italic">No actions logged.</p>}
              </div>
            </div>

            {/* Actions CTA Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
              <a
                href={`/api/incidents/${incidentId}/export`}
                target="_blank"
                rel="noreferrer"
                className="btn-landing-outline text-xs py-2.5 px-4 font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Export Post-Mortem</span>
              </a>

              <Link
                href={`/incidents/${incidentId}`}
                className="btn-landing-primary text-xs py-2.5 px-5 font-bold inline-flex items-center gap-2"
              >
                <span>Return to Incident Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
