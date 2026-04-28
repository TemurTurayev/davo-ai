import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { AwaitingPrescriptionClient } from "@/components/awaiting-prescription/awaiting-prescription-client";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AwaitingPrescriptionPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <AwaitingPrescriptionClient locale={locale} />;
}
