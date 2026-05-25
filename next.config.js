/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // 允许 dev 模式下从局域网 IP / 127.0.0.1 访问 _next/* 资源（Next 15+ 必需）
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
  ],
};

module.exports = nextConfig;
