import { NextResponse } from 'next/server';

// 感情に合わせて声の高さ（pitch）と速さ（rate）を変える設定
// normal は今までの声の感じ（pitch -5%）を基準にしている
const EMOTION_PROSODY: Record<string, { pitch: string; rate: string }> = {
  happy: { pitch: '+8%', rate: '+6%' },
  sad: { pitch: '-8%', rate: '-12%' },
  angry: { pitch: '+3%', rate: '+8%' },
  normal: { pitch: '-5%', rate: '+0%' },
};

// SSMLにそのまま埋め込むため、記号をエスケープする
const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// キャラクターごとの声（ひよりは女性ボイス、はるとは若い男性ボイス）
// pitchShift は声の高さの底上げ（%）。はるとは男の子らしく高めにする
const CHARACTER_VOICES: Record<string, { voice: string; pitchShift: number }> = {
  hiyori: { voice: 'ja-JP-AoiNeural', pitchShift: 0 },
  haruto: { voice: 'ja-JP-NanamiNeural', pitchShift: 0 },
};

export async function POST(req: Request) {
  try {
    const { text, emotion = 'normal', character = 'hiyori' } = await req.json();
    const voiceConfig = CHARACTER_VOICES[character] ?? CHARACTER_VOICES.hiyori;
    const voiceName = voiceConfig.voice;
    const apiKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'japanwest';

    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }

    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const prosody = EMOTION_PROSODY[emotion] ?? EMOTION_PROSODY.normal;

    // 感情ぶんの上下に、キャラごとの底上げを足して最終的な声の高さを決める
    const pitchValue = parseInt(prosody.pitch, 10) + voiceConfig.pitchShift;
    const pitch = `${pitchValue >= 0 ? '+' : ''}${pitchValue}%`;

    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'>
        <voice name='${voiceName}'>
          <prosody pitch="${pitch}" rate="${prosody.rate}">
            ${escapeXml(String(text ?? ''))}
          </prosody>
        </voice>
      </speak>
    `;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    });

    if (!response.ok) {
      throw new Error(`Azure API Error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error) {
    console.error('TTSエラー:', error);
    return NextResponse.json({ error: '音声の生成に失敗しました' }, { status: 500 });
  }
}