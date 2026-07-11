/** @type {import('next').NextConfig} */
const CACHE_BUST = 'v2';
const nextConfig = {
  generateBuildId: async () => {
    return `build-${CACHE_BUST}-${Date.now()}`;
  },
  async headers() {
    return [
      {
        // HTML ドキュメントはキャッシュしない（JSチャンク更新を確実に反映）
        source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};
export default nextConfig;
