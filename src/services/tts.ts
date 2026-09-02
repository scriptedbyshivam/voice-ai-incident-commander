import OpenAI from 'openai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// ─────────────────────────────────────────────────────────────────────────────
// Text-to-Speech Provider Abstraction
//
// The AI Incident Commander speaks by calling `ttsProvider.synthesize(text)`.
// The provider is swappable so the system can move between vendors without
// touching callers.
//
//   - OpenAI  (default) — first-class provider, used when OPENAI_API_KEY is set
//   - ElevenLabs — used when ELEVENLABS_API_KEY is set
//   - Deepgram (drop-in replacement) — used when TTS_PROVIDER=deepgram
//   - Edge    — KEYLESS, FREE (Microsoft Edge Read Aloud) — TTS_PROVIDER=edge
//   - Mock     — offline/sandbox fallback (single-use in tests/dev)
//
// Every provider returns base64 audio content plus the format so the transport
// layer (Agora RTC injection, browser playback) knows how to decode it.
// ─────────────────────────────────────────────────────────────────────────────

export type TTSAudioFormat = 'mp3' | 'wav' | 'mp3_44100';

export interface TTSProviderDescriptor {
  readonly name: string;
}

export interface AISynthesisResult {
  /** The exact text that was synthesized (used for provenance/audit). */
  text: string;
  /** Base64-encoded audio bytes. */
  audioContent: string;
  /** Audio container/codec identifier. */
  format: TTSAudioFormat;
  /** MIME type matching `format` (for <audio> playback and HTTP responses). */
  mimeType: string;
  /** Estimated spoken duration in seconds (approx: 15 wpm … or provider meta). */
  durationSeconds?: number;
}

export interface SynthesizeOptions {
  /** Provider-specific voice/model override, e.g. "alloy", "aura-2-en-alloy". */
  voice?: string;
  /** Eliza's secret sauce: playback speed. Default 1.0. */
  speed?: number;
}

/**
 * The contract every TTS backend implements. Callers depend only on this.
 */
export interface TTSProvider extends TTSProviderDescriptor {
  synthesize(text: string, options?: SynthesizeOptions): Promise<AISynthesisResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI TTS provider
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_TTS_MODEL = 'tts-1';
const OPENAI_TTS_VOICE = 'alloy';

export class OpenAITTSProvider implements TTSProvider {
  readonly name = 'openai';

  private client: OpenAI | null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey || apiKey === 'placeholder_openai_key') {
      console.warn('[TTS:OpenAI] OPENAI_API_KEY not configured. OpenAI TTS disabled.');
      this.client = null;
    } else {
      this.client = new OpenAI({ apiKey });
    }
  }

  /** Public so the factory can resolve the usable provider. */
  isUsable(): boolean {
    return this.client !== null;
  }

  async synthesize(text: string, options?: SynthesizeOptions): Promise<AISynthesisResult> {
    const trimmed = (text || '').trim();
    if (trimmed.length === 0) {
      throw new Error('Cannot synthesize empty text.');
    }

    if (!this.isUsable()) {
      throw new Error('OpenAI TTS is not configured. Set OPENAI_API_KEY to enable.');
    }

    const response = await this.client!.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: (options?.voice as any) || OPENAI_TTS_VOICE,
      input: trimmed,
      response_format: 'mp3',
      speed: (options?.speed ?? 1.0) as any,
    });

    const arrayBuffer = await response.arrayBuffer();
    const audioBytes = Buffer.from(arrayBuffer);

    return {
      text: trimmed,
      audioContent: audioBytes.toString('base64'),
      format: 'mp3',
      mimeType: 'audio/mpeg',
      durationSeconds: estimateDuration(trimmed),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deepgram TTS provider (drop-in replacement seam)
//
// Deepgram exposes a REST synthesis endpoint:
//   POST https://api.deepgram.com/v1/speak?model=aura-2-en-alloy
//   Authorization: Token <DEEPGRAM_API_KEY>
//   JSON body: { "text": "..." }
// Returns raw audio (default MP3).
// ─────────────────────────────────────────────────────────────────────────────

const DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak';
const DEEPGRAM_TTS_MODEL = 'aura-2-en-alloy';

export class DeepgramTTSProvider implements TTSProvider {
  readonly name = 'deepgram';

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[TTS:Deepgram] DEEPGRAM_API_KEY not configured. Deepgram TTS disabled.');
    }
  }

  /** Public so the factory can resolve the usable provider. */
  isUsable(): boolean {
    return !!this.apiKey;
  }

  async synthesize(text: string, options?: SynthesizeOptions): Promise<AISynthesisResult> {
    const trimmed = (text || '').trim();
    if (trimmed.length === 0) {
      throw new Error('Cannot synthesize empty text.');
    }

    if (!this.isUsable()) {
      throw new Error('Deepgram TTS is not configured. Set DEEPGRAM_API_KEY to enable.');
    }

    const url = `${DEEPGRAM_TTS_URL}?model=${encodeURIComponent(
      options?.voice || DEEPGRAM_TTS_MODEL
    )}&encoding=mp3`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: trimmed }),
    });

    if (!res.ok) {
      throw new Error(`Deepgram TTS failed: ${res.status} ${res.statusText}`);
    }

    const audioBytes = Buffer.from(await res.arrayBuffer());

    return {
      text: trimmed,
      audioContent: audioBytes.toString('base64'),
      format: 'mp3',
      mimeType: 'audio/mpeg',
      durationSeconds: estimateDuration(trimmed),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs TTS provider — primary for this deployment.
//
// REST synthesis:
//   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128
//   Headers: xi-api-key: <ELEVENLABS_API_KEY>, Content-Type: application/json
//   Body: { "text": "...", "model_id": "eleven_multilingual_v2", "voice_settings": {...} }
// Returns raw MP3 audio bytes.
// ─────────────────────────────────────────────────────────────────────────────

const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const ELEVENLABS_TTS_MODEL = 'eleven_multilingual_v2';
// Rachel — default voice. Override via ELEVENLABS_VOICE_ID.
const ELEVENLABS_DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM';
// Telephony-grade MP3, matches the transport layer expectations.
const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = 'elevenlabs';

  private apiKey: string;
  private voiceId: string;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE;
    if (!this.apiKey) {
      console.warn('[TTS:ElevenLabs] ELEVENLABS_API_KEY not configured. ElevenLabs TTS disabled.');
    }
  }

  /** Public so the factory can resolve the usable provider. */
  isUsable(): boolean {
    return !!this.apiKey;
  }

  async synthesize(text: string, _options?: SynthesizeOptions): Promise<AISynthesisResult> {
    void _options;
    const trimmed = (text || '').trim();
    if (trimmed.length === 0) {
      throw new Error('Cannot synthesize empty text.');
    }

    if (!this.isUsable()) {
      throw new Error('ElevenLabs TTS is not configured. Set ELEVENLABS_API_KEY to enable.');
    }

    const url = `${ELEVENLABS_TTS_URL}/${encodeURIComponent(this.voiceId)}?output_format=${encodeURIComponent(ELEVENLABS_OUTPUT_FORMAT)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: ELEVENLABS_TTS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`ElevenLabs TTS failed: ${res.status} ${res.statusText}`);
    }

    const audioBytes = Buffer.from(await res.arrayBuffer());

    return {
      text: trimmed,
      audioContent: audioBytes.toString('base64'),
      format: 'mp3',
      mimeType: 'audio/mpeg',
      durationSeconds: estimateDuration(trimmed),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge TTS provider — KEYLESS + FREE.
//
// Uses Microsoft Edge's Read Aloud WebSocket service (the same neural voices
// the Edge browser uses). No API key, no account, no card. Server-side only.
//
// Audio comes back as a Node Readable stream of MP3 bytes.
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_TTS_DEFAULT_VOICE = 'en-US-AriaNeural';

export class EdgeTTSProvider implements TTSProvider {
  readonly name = 'edge';

  private voice: string;

  constructor() {
    this.voice = process.env.EDGE_TTS_VOICE || EDGE_TTS_DEFAULT_VOICE;
  }

  /** No key required — usable whenever explicitly requested. */
  isUsable(): boolean {
    return true;
  }

  async synthesize(text: string, _options?: SynthesizeOptions): Promise<AISynthesisResult> {
    void _options;
    const trimmed = (text || '').trim();
    if (trimmed.length === 0) {
      throw new Error('Cannot synthesize empty text.');
    }
    // MsEdgeTTS inserts text straight into SSML — escape to prevent injection.
    const safe = escapeSSMLText(trimmed);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(this.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(safe);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      audioStream.on('error', (err) => {
        tts.close();
        reject(err);
      });
      audioStream.on('end', () => {
        tts.close();
        resolve();
      });
      audioStream.on('close', () => {
        tts.close();
        resolve();
      });
    });

    const audioBytes = Buffer.concat(chunks);
    if (audioBytes.length === 0) {
      throw new Error('Edge TTS returned no audio.');
    }

    return {
      text: trimmed,
      audioContent: audioBytes.toString('base64'),
      format: 'mp3',
      mimeType: 'audio/mpeg',
      durationSeconds: estimateDuration(trimmed),
    };
  }
}

/** Escape XML special chars so dynamic text cannot break the SSML payload. */
function escapeSSMLText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock TTS provider — offline/sandbox fallback
// ─────────────────────────────────────────────────────────────────────────────

export class MockTTSProvider implements TTSProvider {
  readonly name = 'mock';

  async synthesize(text: string, _options?: SynthesizeOptions): Promise<AISynthesisResult> {
    void _options;
    const trimmed = (text || '').trim();
    console.log(`[TTS:Mock] Synthesizing speech for: "${trimmed.slice(0, 80)}..."`);
    // Tiny silent MP3 stub (0.1s of silence) — decodable by common players.
    return {
      text: trimmed,
      audioContent:
        'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGFtZTMuMTAwA1JhdGgAAAAAAAAAAAAA',
      format: 'mp3',
      mimeType: 'audio/mpeg',
      durationSeconds: estimateDuration(trimmed),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export type TTSProviderName = 'openai' | 'elevenlabs' | 'deepgram' | 'edge' | 'mock';

/**
 * Creates the active TTS provider from configuration.
 *
 * Resolution order:
 *   1. TTS_PROVIDER env var (openai | elevenlabs | deepgram | edge | mock)
 *   2. openai when OPENAI_API_KEY is configured
 *   3. elevenlabs when ELEVENLABS_API_KEY is configured
 *   4. deepgram when DEEPGRAM_API_KEY is configured (and no other key)
 *   5. edge (keyless fallback) then mock
 */
export function createTTSProvider(): TTSProvider {
  const requested = (process.env.TTS_PROVIDER || 'openai').toLowerCase();

  if (requested === 'mock') {
    return new MockTTSProvider();
  }

  if (requested === 'edge') {
    return new EdgeTTSProvider();
  }

  if (requested === 'deepgram') {
    const provider = new DeepgramTTSProvider();
    if (provider.isUsable()) return provider;
    console.warn('[TTS] TTS_PROVIDER=deepgram but DEEPGRAM_API_KEY missing. Falling back to mock.');
    return new MockTTSProvider();
  }

  if (requested === 'elevenlabs') {
    const provider = new ElevenLabsTTSProvider();
    if (provider.isUsable()) return provider;
    console.warn('[TTS] TTS_PROVIDER=elevenlabs but ELEVENLABS_API_KEY missing. Falling back to mock.');
    return new MockTTSProvider();
  }

  // default: openai first, then elevenlabs, then deepgram, then edge, then mock
  const openAi = new OpenAITTSProvider();
  if (openAi.isUsable()) return openAi;

  const elevenLabs = new ElevenLabsTTSProvider();
  if (elevenLabs.isUsable()) return elevenLabs;

  const deepgram = new DeepgramTTSProvider();
  if (deepgram.isUsable()) return deepgram;

  // Keyless, free fallback — always available.
  return new EdgeTTSProvider();
}

/**
 * Backwards-compatible helper. Returns a usable provider reflecting the current
 * environment; primarily useful for tests wanting to introspect the default.
 */
export function getTTSProvider(): TTSProvider {
  return createTTSProvider();
}

/**
 * Rough spoken-duration estimate (~150 words/minute). Used for UI timers and
 * to keep status summaries under ~30 seconds.
 */
export function estimateDuration(text: string): number {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round((words / 150) * 60 * 10) / 10);
}

export const ttsProvider: TTSProvider = createTTSProvider();
export default ttsProvider;