'use client';
import { useRef, useState } from 'react';

type StartOptions = {
  // 聞き取れたテキストが確定したとき
  onResult: (text: string) => void;
  // 画面の状態表示を変えたいとき
  onStatus: (status: string) => void;
  // 途中経過のテキストを表示したいとき（ブラウザ認識のフォールバック時のみ）
  onInterim?: (text: string) => void;
};

// 音声の「聞き取り」だけを担当するフック
// 本命は Azure Speech（ブラウザの種類に依存しないため）
// Azure が使えない環境では、従来の Web Speech API に自動で切り替える
export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const azureRecognizerRef = useRef<any>(null);
  const webRecognitionRef = useRef<any>(null);
  const cancelledRef = useRef(false);

  const stopListening = () => {
    cancelledRef.current = true;
    try {
      azureRecognizerRef.current?.close();
    } catch {
      // 閉じるときのエラーは無視する
    }
    azureRecognizerRef.current = null;
    try {
      webRecognitionRef.current?.stop();
    } catch {
      // 停止時のエラーは無視する
    }
    setIsRecording(false);
  };

  // フォールバック: ブラウザ標準の Web Speech API で聞き取る
  const startWebSpeech = (options: StartOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        reject(new Error('このブラウザは音声認識に対応していません'));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.interimResults = true;
      recognition.continuous = false;
      webRecognitionRef.current = recognition;

      let latestTranscript = '';

      recognition.onresult = (event: any) => {
        const currentText = event.results[0][0].transcript;
        latestTranscript = currentText;
        options.onInterim?.(currentText);
      };

      recognition.onend = () => {
        webRecognitionRef.current = null;
        if (latestTranscript) {
          resolve(latestTranscript);
        } else {
          reject(new Error('声を聞き取れませんでした'));
        }
      };

      recognition.onerror = (event: any) => {
        webRecognitionRef.current = null;
        reject(new Error(`音声認識エラー: ${event.error || '不明'}`));
      };

      recognition.start();
    });
  };

  // 本命: Azure Speech SDK で聞き取る（1回の発話を聞いて自動で終わる）
  const startAzureSpeech = async (options: StartOptions): Promise<string> => {
    const tokenRes = await fetch('/api/get-speech-token');
    if (!tokenRes.ok) {
      throw new Error('Azureのトークンを取得できませんでした');
    }
    const { token, region } = await tokenRes.json();
    if (!token || !region) {
      throw new Error('Azureのトークン情報が不足しています');
    }

    // SDKは重いので、話しかけるボタンを押したときだけ読み込む
    const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk');

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = 'ja-JP';

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    azureRecognizerRef.current = recognizer;

    try {
      const result = await new Promise<any>((resolve, reject) => {
        recognizer.recognizeOnceAsync(resolve, reject);
      });

      if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech && result.text) {
        return result.text as string;
      }
      throw new Error('声を聞き取れませんでした');
    } finally {
      try {
        recognizer.close();
      } catch {
        // 無視する
      }
      if (azureRecognizerRef.current === recognizer) {
        azureRecognizerRef.current = null;
      }
    }
  };

  const startListening = async (options: StartOptions) => {
    if (isRecording) return;
    cancelledRef.current = false;
    setIsRecording(true);
    options.onStatus('あなたの声を聞いています...');

    try {
      let text: string;
      try {
        // まず Azure で聞き取る
        text = await startAzureSpeech(options);
      } catch (azureError) {
        if (cancelledRef.current) return;
        console.warn('Azure音声認識に失敗したため、ブラウザ認識に切り替えます:', azureError);
        options.onStatus('あなたの声を聞いています...（ブラウザ認識）');
        // ダメならブラウザ標準に切り替える
        text = await startWebSpeech(options);
      }

      if (cancelledRef.current) return;
      options.onStatus('声を聞き取りました！');
      options.onResult(text);
    } catch (error) {
      if (cancelledRef.current) return;
      console.error('音声認識エラー:', error);
      options.onStatus('エラーが発生しました');
      alert('音声を聞き取れませんでした。マイクの許可と周りの静かさを確認してもう一度試してください。');
    } finally {
      if (!cancelledRef.current) {
        setIsRecording(false);
      } else {
        setIsRecording(false);
      }
    }
  };

  return { isRecording, startListening, stopListening };
}
