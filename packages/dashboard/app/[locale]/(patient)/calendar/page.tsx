import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { HeatmapCalendar } from "@/components/calendar/heatmap-calendar";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function CalendarPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <HeatmapCalendar locale={locale} />;
}
