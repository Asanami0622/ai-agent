import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Android(Capacitor)からは Vercel 上のサーバーを読み込む方式にするため、
  // 静的書き出し(output: 'export')は使わない。
  // これがあると /api/* のサーバー処理と両立せず、Vercelのビルドが失敗する。
};

export default nextConfig;
