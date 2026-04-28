import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Inter, Manrope, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";

import { TelegramInit } from "@/components/telegram-init";
import { locales, isValidLocale } from "@/i18n/config";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nafas — TB treatment companion",
    template: "%s · Nafas",
  },
  description:
    "AI-assisted TB treatment monitoring. Daily reminders, dose verification, side-effect guidance.",
  applicationName: "Nafas",
  authors: [{ name: "MindTech" }],
  keywords: ["TB", "tuberculosis", "treatment", "adherence", "DOT", "VOT", "Uzbekistan", "AI"],
  manifest: "/manifest.json",
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Telegram WebApp script — must load early */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="bg-organic">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TelegramInit />
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className: "font-body",
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
