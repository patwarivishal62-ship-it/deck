export default function manifest() {
  return {
    name: "DECK — Plan. Track. Achieve.",
    short_name: "DECK",
    description: "Minimal campaign control center for marketing teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F14",
    theme_color: "#7C5CFF",
    icons: [{ src: "/favicon.png", sizes: "2000x2000", type: "image/png", purpose: "any maskable" }],
  };
}
