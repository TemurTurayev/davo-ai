import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { ProfileScreen } from "@/components/profile/profile-screen";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <ProfileScreen locale={locale} />;
}
