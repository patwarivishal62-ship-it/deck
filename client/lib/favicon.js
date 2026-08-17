// Favicon handling for custom branding.
//
// IMPORTANT: the <link rel="icon"> tags in the document head are rendered by
// Next.js from the `metadata.icons` config in app/layout.js, which means React
// owns those DOM nodes. Calling .remove() on one of them rips it out from
// under React — on the next render React tries to remove/replace the same node
// and hits `parentNode.removeChild`, where parentNode is now null. That throws
// "Cannot read properties of null (reading 'removeChild')" during the commit
// phase, which unmounts the whole tree and produces Next.js's generic
// "Application error: a client-side exception has occurred" page. Because the
// branding provider lives in the root layout, it took down every route.
//
// So: never remove (or add) icon links here. Only mutate the href of the
// existing, React-rendered ones. To show "no favicon" we point them at a fully
// transparent 1x1 PNG instead of deleting them.

const BLANK_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function iconLinks() {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll('link[rel~="icon"]'));
}

/**
 * Point every icon link at `url`. Pass a falsy value to blank the favicon out.
 * Safe to call on every render — it's a no-op when nothing changed, and it
 * never adds or removes nodes React is tracking.
 */
export function applyFavicon(url) {
  const href = url || BLANK_ICON;
  iconLinks().forEach((link) => {
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  });
}

export { BLANK_ICON };
