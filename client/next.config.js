/** @type {import('next').NextConfig} */

// Where /api/* requests are forwarded.
//
// - Production (NODE_ENV=production, e.g. the deployed frontend) talks to the
//   deployed API on Render — the same backend the app always shipped against.
// - Local dev (and this sandbox preview) runs the Express server in-process,
//   so it talks to localhost:4000 instead.
//
// Either way you can override the upstream explicitly with the API_UPSTREAM
// env var (e.g. "https://api.example.com").
const RENDER_API = "https://deck-dllq.onrender.com";
const LOCAL_API = "http://localhost:4000";

const API_UPSTREAM =
  process.env.API_UPSTREAM ||
  (process.env.NODE_ENV === "production" ? RENDER_API : LOCAL_API);

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_UPSTREAM}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
