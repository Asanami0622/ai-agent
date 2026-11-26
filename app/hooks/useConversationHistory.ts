'use client';
import { useState, useEffect } from 'react';

export type ChatMessage = { role: string; text: string };

// 会話履歴をブラウザに保存するときのキー（タブを閉じても残る）
const HISTORY_STORAGE_KEY = 'hiyori-conversation-history-v1';

type Options = {
  // 保存先のキー（キャラクターごとに履歴を分けるため）
  storageKey?: string;
  // 復元できたときに、最後の発言・返事を画面に戻すためのコールバック
  onRestore?: (history: ChatMessage[]) => void;
  // 履歴を消したときに、画面表示も消すためのコールバック
  onClear?: () => void;
};

// 会話履歴の「保存・復元・削除」だけを担当するフック
// page.tsx 本体から切り出すことで、本体への変更を最小限にして
// 共同制作でもコンフリクトしにくくしている
export function useConversationHistory(options?: Options) {
  const storageKey = options?.storageKey ?? HISTORY_STORAGE_KEY;
  const [history, setHistory] = useState<ChatMessage[]>([]);
  // 保存済みの履歴を読み終わったか（読み込む前に空の履歴で上書きしないため）
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  // 起動時に1回だけ、保存済みの会話履歴を復元する
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const restored = parsed.filter(
            (item) =>
              item &&
              (item.role === 'user' || item.role === 'model') &&
              typeof item.text === 'string'
          ) as ChatMessage[];
          setHistory(restored);
          if (restored.length > 0) options?.onRestore?.(restored);
        }
      }
    } catch (error) {
      console.error('会話履歴の復元に失敗しました:', error);
    } finally {
      setIsHistoryLoaded(true);
    }
    // 起動時に1回だけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 履歴が変わるたびに保存する（復元が終わってからだけ）
  useEffect(() => {
    if (!isHistoryLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('会話履歴の保存に失敗しました:', error);
    }
  }, [history, isHistoryLoaded]);

  // 履歴を全部消す（最初から話したいとき用）
  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('会話履歴の削除に失敗しました:', error);
    }
    options?.onClear?.();
  };

  return { history, setHistory, clearHistory };
}
