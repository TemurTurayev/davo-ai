import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);

  return <OnboardingWizard locale={locale} />;
}
