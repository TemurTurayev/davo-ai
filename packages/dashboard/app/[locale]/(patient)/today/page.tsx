import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { TodayScreen } from "@/components/today/today-screen";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function TodayPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <TodayScreen locale={locale} />;
}
