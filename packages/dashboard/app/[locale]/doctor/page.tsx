import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { DoctorDashboard } from "@/components/doctor/doctor-dashboard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function DoctorPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <DoctorDashboard locale={locale} />;
}
