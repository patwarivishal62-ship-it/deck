import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Deck — Project Control Center",
  description: "Marketing project, goal, and task tracker.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-ink">
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
