import { NextResponse } from 'next/server';

export async function GET() {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    return NextResponse.json({ error: '環境変数が設定されていません' }, { status: 500 });
  }

  try {
    // Azureに「一時的なトークン」を要求する
    const response = await fetch(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) throw new Error('トークンの取得に失敗しました');

    const token = await response.text();
    return NextResponse.json({ token, region: speechRegion });
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}