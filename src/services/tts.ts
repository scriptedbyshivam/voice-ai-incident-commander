import OpenAI from 'openai';

export class TTSService {
  private openai: OpenAI | null = null;
  private voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.voice = (process.env.OPENAI_TTS_VOICE as any) || 'alloy';

    if (apiKey && apiKey !== 'placeholder_key') {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Synthesizes audio stream from input text.
   * Returns a base64 encoded string of the MP3 audio buffer, or a mock audio URL in development.
   */
  async synthesizeSpeech(text: string): Promise<{ audioContent: string; format: 'mp3' }> {
    if (!this.openai) {
      console.log(`[TTS MOCK] Synthesizing speech for: "${text}"`);
      // Return dummy small base64 representing silent mp3 or sound
      return {
        audioContent: 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGFtZTMuMTAwA1JhdGgAAAAAAAAAAAAA',
        format: 'mp3',
      };
    }

    try {
      const mp3Response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: this.voice,
        input: text,
      });

      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      return {
        audioContent: buffer.toString('base64'),
        format: 'mp3',
      };
    } catch (error) {
      console.error('Error in speech synthesis:', error);
      return {
        audioContent: 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGFtZTMuMTAwA1JhdGgAAAAAAAAAAAAA',
        format: 'mp3',
      };
    }
  }
}

export const ttsService = new TTSService();
