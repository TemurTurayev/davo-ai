import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { PrescriptionEditor } from "@/components/doctor/prescription-editor";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function PrescriptionsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <PrescriptionEditor locale={locale} />;
}
