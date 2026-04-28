import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { AchievementsScreen } from "@/components/achievements/achievements-screen";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AchievementsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <AchievementsScreen locale={locale} />;
}
