import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import Footer from "@/components/Footer";
import PersonalPA from "@/components/PersonalPA";

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
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
            <PersonalPA />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
