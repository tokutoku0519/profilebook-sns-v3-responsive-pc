/** @type {import('next').NextConfig} */
const nextConfig = {
  // キャッシュ無効化のためのビルドID
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};
export default nextConfig;
