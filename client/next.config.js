/** @type {import('next').NextConfig} */

// API base for the /api/* rewrite. Override with API_ORIGIN for local
// development against a different backend (e.g. a mock or localhost server).
const API_ORIGIN = process.env.API_ORIGIN || "https://deck-dllq.onrender.com";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/downloads/:path*.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="DECK.apk"' },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
