import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import Footer from "@/components/Footer";
import PersonalPA from "@/components/PersonalPA";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata = {
  title: "DECK — Plan. Track. Achieve.",
  description: "Professional, minimal campaign control center. Plan projects, track goals, achieve outcomes.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "DECK — Plan. Track. Achieve.",
    description: "Plan projects. Track goals. Achieve outcomes. Minimal, confident, intelligent.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('deck-theme');if(!t||['dark','light','eye'].indexOf(t)===-1) t='dark';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`,
          }}
        />
      </head>
      <body className="bg-paper antialiased">
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary
              fallback={
                <div className="flex min-h-[50vh] items-center justify-center p-6 text-center">
                  <div className="max-w-sm rounded-2xl border border-line bg-card p-6">
                    <p className="font-semibold text-text">Something went wrong</p>
                    <p className="mt-1 text-sm text-text-soft">Please refresh the page. If it persists, contact support.</p>
                    <button onClick={() => window.location.reload()} className="mt-3 rounded-full bg-signal px-4 py-1.5 text-sm font-medium text-white">Refresh</button>
                  </div>
                </div>
              }
            >
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">{children}</div>
                <Footer />
              </div>
            </ErrorBoundary>
            <ErrorBoundary fallback={null}>
              <PersonalPA />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
