// キャラクターごとの設定をまとめたファイル
// モデル・声・タップ台詞・感情パラメータの対応をここに集約し、
// キャラを増やすときはこのファイルに1人分追加するだけで済むようにしている

export type CharacterId = 'hiyori' | 'haruto';

export type EmotionParams = Record<string, number>;

export interface CharacterConfig {
  id: CharacterId;
  // 画面表示用の名前（履歴モーダルなど）
  displayName: string;
  // 返事エリアの見出し
  replyLabel: string;
  // Live2Dモデル（public配下のパス）
  modelPath: string;
  // 背景画像（public配下のパス）キャラごとに部屋を変える
  backgroundPath: string;
  // 大きさの補正（ひより=1.0基準。実機で見ながら調整する）
  scaleAdjust: number;
  // 縦位置の補正（画面の高さに対する割合。マイナスで上に上がる）
  yAdjust?: number;
  // 口パクで動かすパラメータID（モデルごとに名前が違う）
  mouthOpenId: string;
  // 感情パラメータ: base は毎フレーム最初に適用する初期値、
  // happy / sad / angry はその上に上書きする値
  baseParams: EmotionParams;
  emotionParams: Record<'happy' | 'sad' | 'angry', EmotionParams>;
  // タップされたときの固定セリフ
  tapReactions: { text: string; emotion: string }[];
}

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  hiyori: {
    id: 'hiyori',
    displayName: 'ひよりちゃん',
    replyLabel: 'ひよりちゃんの返事：',
    modelPath: '/hiyori_ja/hiyori_pro/runtime/hiyori_pro_t11.model3.json',
    backgroundPath: '/o1080060814180422667.jpg',
    scaleAdjust: 1.0,
    mouthOpenId: 'ParamMouthOpenY',
    baseParams: {
      ParamCheek: 0,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamMouthForm: 0,
      ParamEyeLOpen: 1.0,
      ParamEyeROpen: 1.0,
      ParamBrowLAngle: 0,
      ParamBrowRAngle: 0,
    },
    emotionParams: {
      happy: {
        ParamCheek: 1.0,
        ParamEyeLSmile: 1.0,
        ParamEyeRSmile: 1.0,
        ParamMouthForm: 1.0,
      },
      sad: {
        ParamEyeLOpen: 0.5,
        ParamEyeROpen: 0.5,
        ParamMouthForm: -0.5,
      },
      angry: {
        ParamCheek: 0.5,
        ParamBrowLAngle: -1.0,
        ParamBrowRAngle: -1.0,
        ParamMouthForm: -1.0,
      },
    },
    tapReactions: [
      { text: 'えへへ、くすぐったいよ', emotion: 'happy' },
      { text: 'なあに？呼んだ？', emotion: 'happy' },
      { text: 'わっ！びっくりしたぁ', emotion: 'normal' },
      { text: 'もっとお話ししようね', emotion: 'happy' },
      { text: 'ふふ、触られちゃった', emotion: 'happy' },
    ],
  },
  haruto: {
    id: 'haruto',
    displayName: 'はるとくん',
    replyLabel: 'はるとくんの返事：',
    yAdjust: -0.15,
    modelPath: '/haruto/runtime/haruto.model3.json',
    backgroundPath: '/haruto-room.jpg',
    scaleAdjust: 1.6,
    mouthOpenId: 'PARAM_MOUTH_OPEN_Y',
    baseParams: {
      PARAM_EYE_L_SMILE: 0,
      PARAM_EYE_R_SMILE: 0,
      PARAM_MOUTH_FORM: 0,
      PARAM_CHEEK: 0,
      PARAM_EYE_01: 0,
      PARAM_TEAR_L: 0,
      PARAM_TEAR_R: 0,
      PARAM_EYE_HI: 1,
      PARAM_BROW_L_ANGLE: 0,
      PARAM_BROW_R_ANGLE: 0,
      PARAM_DROOL: 0,
    },
    emotionParams: {
      happy: {
        PARAM_EYE_L_SMILE: 1.0,
        PARAM_EYE_R_SMILE: 1.0,
        PARAM_EYE_01: 1.0, // 目キラキラ
        PARAM_CHEEK: 1.0,
        PARAM_MOUTH_FORM: 1.0,
      },
      sad: {
        PARAM_TEAR_L: 1.0, // 涙
        PARAM_TEAR_R: 1.0,
        PARAM_EYE_HI: 0, // ハイライトを消して沈んだ目に
        PARAM_MOUTH_FORM: -1.0,
      },
      angry: {
        PARAM_BROW_L_ANGLE: -1.0,
        PARAM_BROW_R_ANGLE: -1.0,
        PARAM_MOUTH_FORM: -1.0,
        PARAM_CHEEK: 0.5,
      },
    },
    tapReactions: [
      { text: 'わーい！タッチだ！', emotion: 'happy' },
      { text: 'なになに？ぼくと遊ぶ？', emotion: 'happy' },
      { text: 'うわっ！びっくりした！', emotion: 'normal' },
      { text: 'えへへ、くすぐったいよ', emotion: 'happy' },
      { text: 'ぼく、はると！よろしくね', emotion: 'happy' },
    ],
  },
};
