import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { DoseFlow } from "@/components/dose/dose-flow";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function DosePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <DoseFlow locale={locale} />;
}
