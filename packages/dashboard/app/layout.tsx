import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Davo-AI · Dashboard",
  description: "Doctor dashboard for TB adherence monitoring (MindTech)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="border-b border-[var(--color-border)] bg-white">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-bold">
                D
              </div>
              <div>
                <h1 className="font-semibold text-base">Davo-AI</h1>
                <p className="text-xs text-[var(--color-muted)]">MindTech · MVP</p>
              </div>
            </div>
            <nav className="flex items-center gap-6 text-sm">
              <a href="/" className="hover:text-[var(--color-primary)]">Patients</a>
              <a href="/alerts" className="hover:text-[var(--color-primary)]">
                Alerts
              </a>
              <a href="/queue" className="hover:text-[var(--color-primary)]">
                Review queue
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
