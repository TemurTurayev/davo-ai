import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { LearnScreen } from "@/components/learn/learn-screen";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function LearnPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <LearnScreen locale={locale} />;
}
