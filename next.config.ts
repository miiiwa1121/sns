import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 試作プレビュー（Remotion Player）の staticFile('brand/…') を、動画テンプレートの固定素材へ回す
  async rewrites() {
    return [{ source: '/brand/:path*', destination: '/api/remotion-public/brand/:path*' }];
  },
};

export default nextConfig;
