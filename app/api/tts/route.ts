import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'japanwest';

    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
    }

    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    // 💡 ここが超重要！「七海（Nanami）の元気な声（cheerful）」を指定する呪文（SSML）
    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='ja-JP'>
        <voice name='ja-JP-NanamiNeural'>
          <mstts:express-as style="cheerful">
            ${text}
          </mstts:express-as>
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