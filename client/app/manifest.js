export default function manifest() {
  return {
    name: "DECK — Plan. Track. Achieve.",
    short_name: "DECK",
    description: "Minimal campaign control center for marketing teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F14",
    theme_color: "#7C5CFF",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  };
}
