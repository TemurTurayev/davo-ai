import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { RecordScreen } from "@/components/today/record-screen";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function RecordPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <RecordScreen locale={locale} />;
}
