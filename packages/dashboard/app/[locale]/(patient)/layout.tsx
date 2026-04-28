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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-warm)]">
      <div className="flex-1 pb-20">{children}</div>
      <TabBar locale={locale} />
    </div>
  );
}
