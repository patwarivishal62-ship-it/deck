import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { PWAProvider } from "@/lib/PWAContext";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import ErrorFallback from "@/components/ErrorFallback";
import InstallBanner from "@/components/InstallBanner";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0F14",
};

export const metadata = {
  metadataBase: new URL("https://planyourdeck.com"),
  title: {
    default: "DECK — Plan. Track. Achieve. | Marketing Project Tracker",
    template: "%s | DECK",
  },
  description:
    "DECK is the minimal control center for marketing teams. Plan campaigns, track goals by channel (Social, Paid Ads, SEO, Content, Email), and achieve outcomes — without the noise. Trusted by creators, founders, and marketers.",
  keywords: [
    "marketing project management",
    "campaign planning",
    "marketing tracker",
    "goal tracking",
    "task management for marketers",
    "content calendar",
    "campaign control center",
    "DECK",
    "plan track achieve",
    "marketing ops",
  ],
  authors: [{ name: "DECK", url: "https://planyourdeck.com" }],
  creator: "DECK",
  publisher: "DECK",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://planyourdeck.com",
    siteName: "DECK",
    title: "DECK — Plan. Track. Achieve.",
    description: "Plan campaigns, track goals by channel, achieve outcomes. Minimal, confident, intelligent.",
    images: [
      {
        url: "/favicon.png",
        width: 2000,
        height: 2000,
        alt: "DECK — Plan. Track. Achieve.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DECK — Plan. Track. Achieve.",
    description: "The minimal control center for marketing teams.",
    creator: "@planyourdeck",
    images: ["/favicon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DECK",
    statusBarStyle: "black-translucent",
  },
  category: "productivity",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://planyourdeck.com/#organization",
      name: "DECK",
      url: "https://planyourdeck.com",
      logo: "https://planyourdeck.com/favicon.png",
      sameAs: ["https://www.instagram.com/planyourdeck/", "https://www.facebook.com/planyourdeck"],
      slogan: "Plan. Track. Achieve.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://planyourdeck.com/#app",
      name: "DECK",
      description: "Minimal campaign control center for marketing teams to plan projects, track goals, and achieve outcomes.",
      url: "https://planyourdeck.com",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": "https://planyourdeck.com/#organization" },
    },
    {
      "@type": "WebSite",
      "@id": "https://planyourdeck.com/#website",
      url: "https://planyourdeck.com",
      name: "DECK",
      publisher: { "@id": "https://planyourdeck.com/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://planyourdeck.com/login",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('deck-theme');if(!t||['dark','light','eye'].indexOf(t)===-1) t='dark';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="bg-paper antialiased">
        <ThemeProvider>
          <PWAProvider>
            <AuthProvider>
              <ErrorBoundary fallback={<ErrorFallback />}>
                <div className="flex min-h-screen flex-col">
                  <div className="flex-1">{children}</div>
                  <Footer />
                </div>
                <InstallBanner />
              </ErrorBoundary>
            </AuthProvider>
          </PWAProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
