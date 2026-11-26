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

export async function POST(req: Request) {
  try {
    const { text, emotion = 'normal' } = await req.json();
    const apiKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'japanwest';

    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }

    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const prosody = EMOTION_PROSODY[emotion] ?? EMOTION_PROSODY.normal;

    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'>
        <voice name='ja-JP-AoiNeural'>
          <prosody pitch="${prosody.pitch}" rate="${prosody.rate}">
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