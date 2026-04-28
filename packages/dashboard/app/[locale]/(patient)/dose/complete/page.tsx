import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { DoseCompleteScreen } from "@/components/dose/dose-complete-screen";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function DoseCompletePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <DoseCompleteScreen locale={locale} />;
}
