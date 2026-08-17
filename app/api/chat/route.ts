import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction:
        'あなたは明るく少しお茶目な2Dキャラクターです。親しみやすい口調で、語尾に「のだ」をつけて3行以内の短い文章で返事をしてください。会話のテンポとレスポンス速度を最優先するため、必ず1〜2文、合計50文字以内の短いセリフで返事をしてください。長文は絶対に使用しないでください',
    });

    const formattedHistory = history.map((msg: { role: string; text: string }) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });
  } catch (error: any) {
    console.error('AI応答エラーの詳細:', error);
    // ★ エラーの本当の理由をそのまま画面に返す！
    return NextResponse.json(
      { reply: `エラー詳細: ${error.message || '不明なエラー'}` },
      { status: 500 }
    );
  }
}