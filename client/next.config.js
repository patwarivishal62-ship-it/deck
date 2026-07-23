/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // Proxy /api/* to the Express server so the browser only ever talks
        // to one origin (avoids CORS + makes cookies simpler in dev).
        source: "/api/:path*",
        destination: "https://deck-d1lq.onrender.com/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
