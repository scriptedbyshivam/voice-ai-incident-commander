// Jest global setup — keep TTS hermetic so unit tests never hit the network.
process.env.TTS_PROVIDER = 'mock';
process.env.OPENAI_API_KEY = '';
process.env.ELEVENLABS_API_KEY = '';
process.env.DEEPGRAM_API_KEY = '';
process.env.EDGE_TTS_VOICE = '';