import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { RulesAgreementClient } from "@/components/rules/rules-agreement-client";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function RulesPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <RulesAgreementClient locale={locale} />;
}
