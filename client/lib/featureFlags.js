// Client feature flags.
//
// BRANDING_ENABLED — the custom logo/favicon feature (admin upload at
// /admin/branding, served from GET /api/branding). Currently DISABLED: the app
// always renders the built-in DECK logo and the static favicons declared in
// app/layout.js, and never fetches or applies remote branding.
//
// To re-enable, set NEXT_PUBLIC_ENABLE_BRANDING=true in the client's
// environment (or flip the default below) and rebuild. Nothing was deleted —
// the server routes, the stored branding document, and the admin UI are all
// still here, just gated behind this flag.
//
// Note: this is read at build time, so it must be referenced as the full
// `process.env.NEXT_PUBLIC_ENABLE_BRANDING` literal for Next.js to inline it.
export const BRANDING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BRANDING === "true";
