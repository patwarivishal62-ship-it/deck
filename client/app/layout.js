import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Footer from "@/components/Footer";

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
    <html lang="en" className="dark">
      <body className="bg-[#0B0F14] antialiased">
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
