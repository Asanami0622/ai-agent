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
  const [inputText, setInputText] = useState('');

  // ★ 履歴ポップアップ（モーダル）の開閉フラグ
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Live2D用のパーツ（キャンバスとモデル操作リモコン）
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<any>(null);

  // 音声再生はお休み中（テキストチャットのみ）
  const speakText = (text: string) => {
    console.log("AIの返答:", text);
    // 今は声を出さないので中身は空でOK！
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

  // テキストメッセージを送信する処理
  const handleTextSubmit = async () => {
    if (!inputText.trim() || isThinking) return;

    const messageToSend = inputText;
    setInputText(''); // 送信したら入力欄を空に戻す
    setTranscript(messageToSend); // 画面の「あなた：」の表示を更新

    // AIの脳みそにテキストを送る
    await askBrain(messageToSend);
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
          // PC・横画面：膝上〜頭までが収まる設定
          const scale = (h / 1000) * 0.40; 
          model.scale.set(scale);
          model.position.set(w / 2, h * 0.75);
        } else {
          // スマホ・縦画面：横幅(w)を基準にしてドーンと大きく表示！
          const scale = (w / 1000) * 0.40; 
          model.scale.set(scale);
          model.position.set(w / 2, h * 0.58);
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

        {/* ＝ ★ 履歴表示ボタン（画面右上に配置） ＝ */}
        <button
          onClick={() => setShowHistoryModal(true)}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(5px)',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#333',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          📜 会話履歴 ({history.length / 2}件)
        </button>

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

          {/* テキスト入力フォーム */}
          <div style={{ display: 'flex', width: '100%', gap: '8px', marginTop: '4px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder="メッセージを入力..."
              disabled={isThinking}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '30px',
                border: 'none',
                fontSize: '14px',
                outline: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            />
            <button
              onClick={handleTextSubmit}
              disabled={isThinking || !inputText.trim()}
              style={{
                padding: '0 20px',
                backgroundColor: isThinking || !inputText.trim() ? '#bdc3c7' : '#3498db',
                color: '#fff',
                border: 'none',
                borderRadius: '30px',
                fontWeight: 'bold',
                cursor: isThinking || !inputText.trim() ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              送信
            </button>
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

        {/* ＝ ★ 会話履歴モーダル（モーダル表示時のみ出現） ＝ */}
        {showHistoryModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px',
            }}
            onClick={() => setShowHistoryModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()} // 内側タップで閉じないように保護
              style={{
                width: '100%',
                maxWidth: '500px',
                maxHeight: '80vh',
                backgroundColor: '#fff',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                overflow: 'hidden',
              }}
            >
              {/* モーダルヘッダー */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8f9fa',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>📜 会話履歴</h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#888',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* モーダル内容（メッセージ一覧） */}
              <div
                style={{
                  padding: '16px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {history.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', margin: '30px 0' }}>
                    まだ会話の履歴がありません。
                  </p>
                ) : (
                  history.map((item, index) => {
                    const isUser = item.role === 'user';
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isUser ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>
                          {isUser ? 'あなた' : 'ひよりちゃん'}
                        </span>
                        <div
                          style={{
                            maxWidth: '80%',
                            padding: '10px 14px',
                            borderRadius: '16px',
                            backgroundColor: isUser ? '#3498db' : '#e8f8f5',
                            color: isUser ? '#fff' : '#2c3e50',
                            borderBottomRightRadius: isUser ? '2px' : '16px',
                            borderBottomLeftRadius: isUser ? '16px' : '2px',
                            fontSize: '14px',
                            lineHeight: '1.4',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          }}
                        >
                          {item.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}