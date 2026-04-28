/**
 * Role Selector — first screen.
 * Replaces the old marketing landing.
 *
 * UX: two large buttons, glass-card style. No marketing fluff.
 * After role selection:
 *   - Patient → /[locale]/today (or rules-agreement if not consented)
 *   - Doctor  → /[locale]/doctor
 *
 * Patient experience is intentionally constrained: doctor prescribes,
 * patient follows. Only theme + language are patient choices.
 */

import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { RoleSelectorClient } from "@/components/role-selector/role-selector-client";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function RoleSelectorPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);

  return <RoleSelectorClient locale={locale} />;
}
