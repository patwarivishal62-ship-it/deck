export default function manifest() {
  return {
    id: "/",
    name: "DECK — Plan. Track. Achieve.",
    short_name: "DECK",
    description: "Minimal campaign control center for marketing teams.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0B0F14",
    theme_color: "#7C5CFF",
    categories: ["productivity", "business"],
    launch_handler: { client_mode: "navigate-existing" },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Projects",
        short_name: "Projects",
        description: "Open your project dashboard",
        url: "/projects",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Calendar",
        short_name: "Calendar",
        description: "Open your content calendar",
        url: "/calendar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Personal",
        short_name: "Personal",
        description: "Open your personal board",
        url: "/personal",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
