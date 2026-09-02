'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CommanderAgentState =
  | 'idle'
  | 'connecting'
  | 'running'
  | 'ending'
  | 'error'
  | 'unavailable';

export type CommanderAgentPresence = 'idle' | 'listening' | 'thinking' | 'speaking' | 'silent';

export interface AgentTranscriptEntry {
  uid: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
  isAgent: boolean;
}

export interface ConnectCommanderArgs {
  incidentId: string;
  channelName: string;
  token: string;
  appId: string;
  requesterUid: string;
  /** Dedicated, collision-free RTM user id for this commander connection. */
  rtmUid?: string;
  /** Dedicated RTM token minted for `rtmUid`. */
  rtmToken?: string;
  agentUid: number;
  rtcClient: any;
}

interface Runtime {
  ai: any;
  rtm: any;
  channel: string;
  incidentId: string;
  agentId: string;
  onUserPublished: (user: unknown, mediaType: string) => void;
  onUserLeft: (user: unknown) => void;
  disposed: boolean;
}

const AGENT_STATES: Record<string, CommanderAgentPresence> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
  silent: 'silent',
};

// ─────────────────────────────────────────────────────────────────────────────
// Agora RTM 2.x singleton manager with collision prevention & safe retries.
// ─────────────────────────────────────────────────────────────────────────────
let rtmSingleton: { rtm: any; appId: string; uid: string; inUse: boolean } | null = null;

async function acquireRtm(
  appId: string,
  requesterUid: string,
  token: string,
  opts: { rtmUid?: string; rtmToken?: string } = {}
): Promise<any> {
  const { default: AgoraRTM } = await import('agora-rtm');

  // Always enforce a fresh, collision-free RTM UID if not provided or to avoid -10027
  const rtmUid = opts.rtmUid || `rtm-${requesterUid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const rtmToken = opts.rtmToken || token;

  // Cleanup any lingering inactive RTM instance
  if (rtmSingleton) {
    try {
      await rtmSingleton.rtm?.logout?.();
    } catch {
      /* best effort */
    }
    rtmSingleton = null;
  }

  try {
    const rtm = new AgoraRTM.RTM(appId, rtmUid);
    await rtm.login({ token: rtmToken });
    rtmSingleton = { rtm, appId, uid: rtmUid, inUse: true };
    return rtm;
  } catch (err: any) {
    // If -10027 (SAME_UID_LOGIN) occurs, fallback to a 100% unique random UID retry
    if (err?.code === -10027 || err?.message?.includes('-10027') || err?.message?.includes('already in use')) {
      const retryUid = `rtm-retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const retryRtm = new AgoraRTM.RTM(appId, retryUid);
      await retryRtm.login({ token: rtmToken });
      rtmSingleton = { rtm: retryRtm, appId, uid: retryUid, inUse: true };
      return retryRtm;
    }
    throw err;
  }
}

function releaseRtm(rtm: any): void {
  if (rtmSingleton && rtmSingleton.rtm === rtm) {
    rtmSingleton.inUse = false;
  }
}

async function dropRtm(rtm: any): Promise<void> {
  if (rtmSingleton && rtmSingleton.rtm === rtm) {
    rtmSingleton.inUse = false;
  }
  try {
    await rtm?.logout?.();
  } catch {
    /* best effort */
  }
  if (rtmSingleton && rtmSingleton.rtm === rtm) {
    rtmSingleton = null;
  }
}

export function useCommanderAgent() {
  const [state, setState] = useState<CommanderAgentState>('idle');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [presence, setPresence] = useState<CommanderAgentPresence>('idle');
  const [agentOnline, setAgentOnline] = useState(false);
  const [entries, setEntries] = useState<AgentTranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runtimeRef = useRef<Runtime | null>(null);
  const rtcClientRef = useRef<any>(null);
  const agentUidRef = useRef<number>(0);

  const connectAgent = useCallback(async (args: ConnectCommanderArgs) => {
    if (runtimeRef.current && !runtimeRef.current.disposed) return;

    setError(null);
    setState('connecting');

    try {
      // 1. Invite the Conversational AI agent to the channel.
      const inviteRes = await fetch(`/api/incidents/${args.incidentId}/agent/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_id: args.requesterUid,
          channel_name: args.channelName,
        }),
      }).catch(() => null);

      if (!inviteRes) throw new Error('Agora agent control plane unreachable.');
      const inviteData = await inviteRes.json().catch(() => ({}));
      if (!inviteRes.ok || !inviteData.agent_id) {
        throw new Error(inviteData.error || `Agent invite failed (${inviteRes.status})`);
      }

      // 2. Boot RTM with collision-free UID & retry protection
      const rtm = await acquireRtm(args.appId, args.requesterUid, args.token, {
        rtmUid: args.rtmUid,
        rtmToken: args.rtmToken,
      });
      await rtm.subscribe(args.channelName);

      // 3. Initialize the Agora Voice AI toolkit against the already-joined RTC client.
      const toolkit = await import('agora-agent-client-toolkit');
      const ai = await toolkit.AgoraVoiceAI.init({
        rtcEngine: args.rtcClient,
        rtmConfig: { rtmEngine: rtm },
        renderMode: toolkit.TranscriptHelperMode.TEXT,
        enableLog: false,
      });

      const fromCallbacks = {
        setEntries,
        setPresence,
        setAgentOnline,
        setError,
      };
      const requesterUid = args.requesterUid;
      const agentUid = String(args.agentUid);

      ai.on(toolkit.AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, (transcript: any[]) => {
        const items: AgentTranscriptEntry[] = (transcript || [])
          .filter((item: any) => item && typeof item.text === 'string' && item.text.length > 0)
          .map((item: any) => {
            const isUser = String(item.uid) === '0' || String(item.uid) === requesterUid;
            return {
              uid: String(item.uid),
              text: item.text,
              isFinal: item.status !== 0,
              timestamp: typeof item._time === 'number' ? item._time : Date.now(),
              isAgent: !isUser,
            };
          });
        fromCallbacks.setEntries(items.slice(-60));
      });

      ai.on(toolkit.AgoraVoiceAIEvents.AGENT_STATE_CHANGED, (_agentUserId: string, event: any) => {
        const next = AGENT_STATES[event?.state];
        if (next) fromCallbacks.setPresence(next);
      });

      ai.on(toolkit.AgoraVoiceAIEvents.AGENT_ERROR, (_agentUserId: string, err: any) => {
        fromCallbacks.setError(err?.message || 'Agent channel error.');
      });

      ai.on(toolkit.AgoraVoiceAIEvents.MESSAGE_ERROR, (_agentUserId: string, err: any) => {
        fromCallbacks.setError(err?.message || 'Agent message error.');
      });

      ai.subscribeMessage(args.channelName);

      // 4. Subscribe the agent's remote audio
      const rtcClient = args.rtcClient;
      rtcClientRef.current = rtcClient;
      agentUidRef.current = args.agentUid;

      const onUserPublished = async (user: any, mediaType: string) => {
        if (mediaType !== 'audio') return;
        try {
          await rtcClient.subscribe(user, mediaType);
          user.audioTrack?.play?.();
        } catch (err) {
          console.warn('[CommanderAgent] remote audio subscribe failed:', err);
        }
        if (String(user.uid) === agentUid) fromCallbacks.setAgentOnline(true);
      };
      const onUserLeft = (user: any) => {
        if (String(user.uid) === agentUid) fromCallbacks.setAgentOnline(false);
      };
      rtcClient.on('user-published', onUserPublished);
      rtcClient.on('user-left', onUserLeft);

      const alreadyJoined = (rtcClient.remoteUsers || []).some(
        (u: any) => String(u.uid) === agentUid
      );
      fromCallbacks.setAgentOnline(alreadyJoined);

      runtimeRef.current = {
        ai,
        rtm,
        channel: args.channelName,
        incidentId: args.incidentId,
        agentId: inviteData.agent_id,
        onUserPublished,
        onUserLeft,
        disposed: false,
      };

      setAgentId(inviteData.agent_id as string);
      setPresence('idle');
      setState('running');
    } catch (err: any) {
      console.error('[CommanderAgent] failed to connect:', err);
      setError(err?.message || 'Failed to connect the Conversational AI Commander.');
      setState('error');
    }
  }, []);

  const disconnectAgent = useCallback(async () => {
    const runtime = runtimeRef.current;
    const rtcClient = rtcClientRef.current;
    if (!runtime || runtime.disposed) return;

    runtime.disposed = true;
    setState('ending');

    if (runtime.agentId && runtime.incidentId) {
      fetch(`/api/incidents/${runtime.incidentId}/agent/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: runtime.agentId }),
      }).catch(() => {});
    }

    if (rtcClient) {
      rtcClient.off('user-published', runtime.onUserPublished);
      rtcClient.off('user-left', runtime.onUserLeft);
    }
    try {
      runtime.ai?.unsubscribeMessage(runtime.channel);
      runtime.ai?.destroy();
    } catch (err) {
      console.warn('[CommanderAgent] ai cleanup:', err);
    }
    try {
      await dropRtm(runtime.rtm);
    } catch (err) {
      console.warn('[CommanderAgent] rtm logout:', err);
    }

    runtimeRef.current = null;
    rtcClientRef.current = null;
    agentUidRef.current = 0;
    setEntries([]);
    setPresence('idle');
    setAgentOnline(false);
    setAgentId(null);
    setState('idle');
  }, []);

  useEffect(() => {
    const onUnmount = () => {
      const runtime = runtimeRef.current;
      if (!runtime || runtime.disposed) return;
      runtime.disposed = true;
      const rtcClient = rtcClientRef.current;
      if (rtcClient) {
        rtcClient.off('user-published', runtime.onUserPublished);
        rtcClient.off('user-left', runtime.onUserLeft);
      }
      try {
        runtime.ai?.unsubscribeMessage?.(runtime.channel);
        runtime.ai?.destroy();
      } catch {}
      try {
        releaseRtm(runtime.rtm);
        void runtime.rtm?.logout?.().catch(() => {});
      } catch {}
    };
    return onUnmount;
  }, []);

  return {
    state,
    agentId,
    presence,
    agentOnline,
    entries,
    error,
    connectAgent,
    disconnectAgent,
  };
}