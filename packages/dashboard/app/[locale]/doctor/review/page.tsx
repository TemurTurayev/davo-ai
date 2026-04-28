import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { VideoReviewQueue } from "@/components/doctor/video-review-queue";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ReviewPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <VideoReviewQueue locale={locale} />;
}
