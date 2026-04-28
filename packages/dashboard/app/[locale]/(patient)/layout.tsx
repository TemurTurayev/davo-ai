import { TabBar } from "@/components/layout/tab-bar";
import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function PatientLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);

  // Mobile-first: clamp to ~480px on desktop. Telegram Mini App ~360-420px wide.
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-slate-100)]">
      <div className="flex-1 pb-20 max-w-md w-full mx-auto bg-[var(--color-bg-warm)] shadow-xl relative">
        {children}
      </div>
      <TabBar locale={locale} />
    </div>
  );
}
