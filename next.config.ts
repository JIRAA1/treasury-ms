import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // อนุญาตโดเมน Ngrok สำหรับการพัฒนา
  allowedDevOrigins: [
    'cartel-cosponsor-eldercare.ngrok-free.dev',
    'localhost:3000'
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'cartel-cosponsor-eldercare.ngrok-free.dev',
        'localhost:3000'
      ]
    }
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://cartel-cosponsor-eldercare.ngrok-free.dev' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  }
};

export default nextConfig;
