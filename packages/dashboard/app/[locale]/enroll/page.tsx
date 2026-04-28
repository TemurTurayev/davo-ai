import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { FaceEnrollScreen } from "@/components/enroll/face-enroll-screen";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function EnrollPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <FaceEnrollScreen locale={locale} />;
}
