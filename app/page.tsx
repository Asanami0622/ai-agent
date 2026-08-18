'use client';
import { useState, useRef } from 'react';
import Script from 'next/script';

export default function Home() {
  const [agentState, setAgentState] = useState('待機中...');
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [history, setHistory] = useState<{ role: string; text: string }[]>([]);

  // Live2D用のパーツ（キャンバスとモデル操作リモコン）
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<any>(null);

  // VOICEVOXで音声合成して再生する処理（口パク連動版）
  const speakText = async (text: string) => {
    try {
      const speakerId = 3;
      const queryRes = await fetch(
        `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
        { method: 'POST' }
      );
      const queryData = await queryRes.json();

      const synthesisRes = await fetch(
        `http://localhost:50021/synthesis?speaker=${speakerId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryData),
        }
      );
      const audioBlob = await synthesisRes.blob();

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // 音声を分析して口パクさせる処理
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      const source = audioContext.createMediaElementSource(audio);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMouth = () => {
        if (audio.paused || audio.ended || !modelRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const volume = Math.min(average / 30, 1.0);

        modelRef.current.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', volume);

        requestAnimationFrame(updateMouth);
      };

      audio.onplay = () => {
        audioContext.resume();
        updateMouth();
      };

      audio.onended = () => {
        if (modelRef.current) {
          modelRef.current.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0);
        }
      };

      audio.play();
    } catch (error) {
      console.error('VOICEVOXエラー:', error);
      alert('VOICEVOXが起動しているか確認してね！');
    }
  };

  // AIのAPI（脳）へメッセージを送る処理
  const askBrain = async (text: string) => {
    if (!text) return;
    setIsThinking(true);
    setAgentState('考え中...');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history }),
      });
      const data = await res.json();

      setAiReply(data.reply);
      setAgentState('お返事完了！');

      speakText(data.reply);

      setHistory((prev) => [
        ...prev,
        { role: 'user', text: text },
        { role: 'model', text: data.reply },
      ]);
    } catch (error) {
      console.error(error);
      setAiReply('うまくお返事できなかったみたい…');
      setAgentState('エラーが発生しました');
    } finally {
      setIsThinking(false);
    }
  };

  // マイクでの音声認識を開始・停止する処理
  const handleTalkButton = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('【診断結果】このブラウザは音声認識機能に対応していません！');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsRecording(true);
        setAgentState('あなたの声を聞いています...');
        setTranscript('');
        setAiReply('');
      };

      recognition.onresult = (event: any) => {
        const currentText = event.results[0][0].transcript;
        setTranscript(currentText);
        recognitionRef.current.latestTranscript = currentText;
      };

      recognition.onend = () => {
        setIsRecording(false);
        setAgentState('声を聞き取りました！');
        if (recognitionRef.current?.latestTranscript) {
          askBrain(recognitionRef.current.latestTranscript);
          recognitionRef.current.latestTranscript = '';
        } else {
          setAgentState('待機中...');
        }
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        setAgentState('エラーが発生しました');
        console.error('音声認識エラー:', event.error);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      alert(`【起動エラー】: ${err.message}`);
    }
  };

  // Live2D の準備と描画を行う処理（レスポンシブ・スマホ縦画面最適化）
  const handleLive2DLoad = async () => {
    try {
      const PIXI = await import('pixi.js');
      (window as any).PIXI = PIXI;
      const { Live2DModel } = await import('pixi-live2d-display/cubism4');

      const width = window.innerWidth;
      const height = window.innerHeight;

      const app = new PIXI.Application({
        view: canvasRef.current as HTMLCanvasElement,
        autoStart: true,
        backgroundAlpha: 0,
        width: width,
        height: height,
        resizeTo: window, // 画面リサイズに追従
      });

      const model = await Live2DModel.from('/hiyori_ja/hiyori_pro/runtime/hiyori_pro_t11.model3.json');

      model.anchor.set(0.5, 0.5);

      // 画面の向きや大きさに合わせてスケールと位置を最適計算する関数
      const resizeModel = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;

        const isLandscape = w > h;

        if (isLandscape) {
          // PC・横画面：膝上〜頭までが画面に収まる絶妙な大きさと位置
          const scale = (h / 1000) * 0.40; 
          model.scale.set(scale);
          model.position.set(w / 2, h * 0.75);
        } else {
          // スマホ・縦画面：膝上〜頭まで収める設定
          const scale = (h / 1000) * 0.85; 
          model.scale.set(scale);
          model.position.set(w / 2, h * 0.60);
        }
      };

      resizeModel();
      window.addEventListener('resize', resizeModel);

      app.stage.addChild(model as any);
      modelRef.current = model;
    } catch (error) {
      console.error('Live2Dの表示エラー:', error);
      alert('Live2Dの読み込みに失敗しました。');
    }
  };

  return (
    <>
      {/* 安定版のLive2D Core読み込み */}
      <Script
        src="https://cdn.jsdelivr.net/npm/live2dcubismcore@1.0.2/live2dcubismcore.min.js"
        strategy="afterInteractive"
        onLoad={handleLive2DLoad}
      />

      {/* ＝＝＝ 画面全体のコンテナ（フルスクリーン） ＝＝＝ */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 背景画像 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'url("/o1080060814180422667.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: -1,
          }}
        />

        {/* ＝ Live2D キャンバス ＝ */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* ＝ 操作パネル（画面下部・腰付近に配置） ＝ */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '92%',
            maxWidth: '480px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 10,
          }}
        >
          {/* 状態表示 */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(5px)',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#333',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            状態: {agentState}
          </div>

          {/* あなたの発言 */}
          <div
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(5px)',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              color: '#333',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>あなた：</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', fontWeight: '500', lineHeight: '1.2' }}>
              {transcript || '（話しかけてください）'}
            </p>
          </div>

          {/* ひよりちゃんの返事 */}
          <div
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: 'rgba(232, 248, 245, 0.9)',
              backdropFilter: 'blur(5px)',
              borderBottom: '3px solid #1abc9c',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              color: '#333',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '11px', color: '#16a085', fontWeight: 'bold' }}>
              ひよりちゃんの返事：
            </p>
            <p style={{ margin: '2px 0 0 0', fontSize: '14px', lineHeight: '1.3', fontWeight: 'bold' }}>
              {aiReply || '（AIのお返事）'}
            </p>
          </div>

          {/* 話しかけるボタン */}
          <button
            onClick={handleTalkButton}
            disabled={isThinking}
            style={{
              width: '100%',
              padding: '12px 0',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#fff',
              backgroundColor: isRecording ? '#e74c3c' : isThinking ? '#95a5a6' : '#333',
              border: 'none',
              borderRadius: '30px',
              cursor: isThinking ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              transition: 'all 0.3s ease',
            }}
          >
            {isRecording ? '録音を停止する' : isThinking ? '考え中...' : '話しかける'}
          </button>
        </div>
      </div>
    </>
  );
}