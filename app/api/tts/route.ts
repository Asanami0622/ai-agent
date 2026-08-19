import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!apiKey || !region) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }

    // Azure APIのエンドポイント
    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    // ★ここで声の種類を設定！（ja-JP-NanamiNeural ＝ 七海ちゃん）
    const voiceName = "ja-JP-NanamiNeural";

    // 音声合成のリクエスト形式（SSML）
    const ssml = `
      <speak version='1.0' xml:lang='ja-JP'>
        <voice xml:lang='ja-JP' xml:gender='Female' name='${voiceName}'>
          ${text}
        </voice>
      </speak>
    `;

    // Azureへリクエスト送信
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'HiyoriAgent'
      },
      body: ssml
    });

    if (!response.ok) {
      throw new Error('音声の生成に失敗しました');
    }

    // 出来上がった音声データ（MP3）を取得
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error) {
    console.error("TTS Error:", error);
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}