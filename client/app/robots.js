export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/projects/", "/calendar", "/team", "/settings", "/admin"],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/api/", "/projects/", "/calendar", "/team", "/settings", "/admin"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
      },
    ],
    sitemap: "https://planyourdeck.com/sitemap.xml",
  };
}
