"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children, framed = false }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  return (
    <div className="min-h-screen bg-[#D8DCE8] p-0 sm:p-3 lg:p-4">
      <div className="relative mx-auto flex min-h-screen overflow-hidden bg-white shadow-[0_16px_48px_rgba(16,26,53,0.18)] sm:min-h-[calc(100vh-24px)] sm:rounded-[16px] lg:min-h-[calc(100vh-32px)]">
        <div className="hidden h-auto self-stretch lg:flex">
          <Sidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" className="absolute inset-0 bg-[#101A35]/40" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            <div className="relative h-full w-[220px] shadow-xl">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col bg-[#F8F9FC]">
          {framed ? (
            <div className="mx-auto w-full max-w-[720px] flex-1 px-4 py-4 sm:px-6 sm:py-5">
              <Header onMenu={() => setMobileOpen(true)} />
              {children}
            </div>
          ) : (
            <>
              <div className="px-4 pt-4 sm:px-6 sm:pt-5">
                <Header onMenu={() => setMobileOpen(true)} />
              </div>
              <div className="min-w-0 flex-1 overflow-auto">{children}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
