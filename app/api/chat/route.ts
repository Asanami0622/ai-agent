import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      // ★ 変更点1＆2: プロンプトの修正とJSONモードの指定
      systemInstruction: `あなたは「ひより」という名前の女性で、明るく少しお茶目な2Dキャラクターです。
親しみやすい口調で、3行以内の短い文章で返事をしてください。
会話のテンポとレスポンス速度を最優先するため、必ず1〜2文、合計50文字以内の短いセリフで返事をしてください。長文は絶対に使用しないでください。

【重要】必ず以下のJSONフォーマットのみで出力してください。
{
  "reply": "ここにお返事のテキスト",
  "emotion": "happy" // happy, sad, angry, normal のいずれか1つを選択
}`,
      generationConfig: {
        responseMimeType: 'application/json',
      },
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

    // ★ 変更点3: 返ってきたJSON文字列をオブジェクトに変換して返す
    const responseJson = JSON.parse(responseText);

    return NextResponse.json({
      reply: responseJson.reply,
      emotion: responseJson.emotion,
    });
    
  } catch (error: any) {
    console.error('AI応答エラーの詳細:', error);
    // エラー時もフロントエンドが壊れないようにJSON形式で返す
    return NextResponse.json(
      { reply: `エラー詳細: ${error.message || '不明なエラー'}`, emotion: 'sad' },
      { status: 500 }
    );
  }
}