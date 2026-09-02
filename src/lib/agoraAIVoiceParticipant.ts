'use client';

export interface AIVoiceParticipantOptions {
  appId: string;
  channelName: string;
  token: string;
  /** Reserved, stable uid/account unique to the AI within the incident channel. */
  uid: number | string;
  /** Mock/sandbox mode — skip channel join, keep local-only playback. */
  sandbox?: boolean;
}

export interface AIVoiceParticipantHandle {
  /** Inject an utterance's audio (by API url) into the room + local speakers. */
  speakUrl: (url: string) => Promise<void>;
  /** Best-effort speak: server audio when available, browser TTS otherwise. */
  speak: (utterance: { text: string; audioUrl?: string | null }) => Promise<void>;
  /** True when the AI is actively publishing audio into the channel. */
  isLive: boolean;
  dispose: () => Promise<void>;
}

/**
 * Local browser speech fallback. Used when no TTS backend produced audio bytes
 * (e.g. sandbox/mock mode, or a vendor key that only supports STT). Keeps the
 * AI Incident Commander audible with zero external dependencies.
 */
export function speakTextLocal(text: string): void {
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

/**
 * Client-side Agora participant for the AI Incident Commander.
 *
 * When the live channel is available we join it with a dedicated uid and
 * publish a custom audio track whose source is a Web-Audio media stream; every
 * synthesized utterance is decoded and routed into that track (plus the local
 * speakers). If Agora/SDK isn't available (mock/sandbox mode) we degrade to
 * local-only playback so the operator still hears the commander.
 */
export async function startAIVoiceParticipant(
  opts: AIVoiceParticipantOptions
): Promise<AIVoiceParticipantHandle> {
  const audioCtx = new AudioContext();
  const mediaDest = audioCtx.createMediaStreamDestination();
  const channelGain = audioCtx.createGain();
  channelGain.gain.value = 1;
  channelGain.connect(mediaDest);

  const speakerGain = audioCtx.createGain();
  speakerGain.gain.value = 1;
  speakerGain.connect(audioCtx.destination);

  let client: any = null;
  let publishedTrack: any = null;
  let disposed = false;

  // Try to join the real Agora channel with the AI's dedicated identity.
  try {
    if (!opts.sandbox) {
      const agoraModule = await import('agora-rtc-sdk-ng').catch(() => null);
      if (agoraModule?.default) {
        const AgoraRTC = agoraModule.default;
        client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        await client.join(opts.appId, opts.channelName, opts.token, opts.uid);
        publishedTrack = AgoraRTC.createCustomAudioTrack({
          mediaStreamTrack: mediaDest.stream.getAudioTracks()[0],
        });
        await client.publish([publishedTrack]);
      }
    }
  } catch {
    // Sandbox fallback — local-only playback is handled below.
    client = null;
    publishedTrack = null;
  }

  const playBuffer = async (arrayBuffer: ArrayBuffer) => {
    if (disposed) return;
    if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(channelGain);
    source.connect(speakerGain);
    source.start();
  };

  const tryPlayUrl = async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return false;
      const arrayBuffer = await res.arrayBuffer();
      await playBuffer(arrayBuffer);
      return true;
    } catch {
      return false;
    }
  };

  return {
    isLive: !!(client && publishedTrack),
    speakUrl: async (url) => {
      await tryPlayUrl(url);
    },
    speak: async ({ text, audioUrl }) => {
      const played = audioUrl ? await tryPlayUrl(audioUrl) : false;
      if (!played) speakTextLocal(text);
    },
    dispose: async () => {
      disposed = true;
      if (publishedTrack) publishedTrack.close();
      if (client) {
        try {
          await client.leave();
        } catch {
          /* best effort */
        }
      }
      await audioCtx.close().catch(() => {});
    },
  };
}

/** Stable Agora uid used by the AI within an incident channel. */
export const AI_PARTICIPANT_UID = 1001;
/** Display identity for the AI in the intercom roster. */
export const AI_PARTICIPANT_NAME = 'AI Incident Commander';