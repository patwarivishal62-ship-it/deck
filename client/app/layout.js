import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata = {
  title: "Deck — Project Control Center",
  description: "Marketing project, goal, and task tracker.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
