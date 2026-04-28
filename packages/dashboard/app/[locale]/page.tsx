/**
 * Landing page — visible when user opens the app outside of Telegram
 * Inside Telegram WebApp: Telegram → /start → button "Open TB Control" → here.
 *
 * Layout: hero + 4 features + trust badges + 2 CTAs (Patient/Doctor)
 * Mobile-first (Telegram Mini App ~360px width)
 */

import { Bell, Camera, MessageCircleHeart, Stethoscope, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { TBControlLogo } from "@/components/brand/tb-control-logo";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations();
  const tBrand = await getTranslations("brand");
  const tLanding = await getTranslations("landing");

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <TBControlLogo size={28} showWordmark />
        <LanguageSwitcher current={locale} />
      </header>

      {/* Hero */}
      <section className="px-5 pt-6 pb-10">
        <div className="flex justify-center mb-6">
          <TBControlLogo size={72} />
        </div>
        <h1 className="text-center font-heading mb-3" style={{ fontSize: 28, fontWeight: 800 }}>
          {tLanding("hero_title")}
        </h1>
        <p className="text-center text-[var(--color-slate-500)] max-w-md mx-auto">
          {tLanding("hero_sub")}
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <TrustBadge icon={<ShieldCheck size={14} />}>
            {tLanding("trust_badges.who")}
          </TrustBadge>
          <TrustBadge icon={<ShieldCheck size={14} />}>
            {tLanding("trust_badges.moh")}
          </TrustBadge>
          <TrustBadge icon={<ShieldCheck size={14} />}>
            {tLanding("trust_badges.secure")}
          </TrustBadge>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-5 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FeatureCard
            icon={<Bell className="text-[var(--color-brand)]" />}
            title={tLanding("features.reminder.title")}
            body={tLanding("features.reminder.body")}
          />
          <FeatureCard
            icon={<Camera className="text-[var(--color-accent)]" />}
            title={tLanding("features.video.title")}
            body={tLanding("features.video.body")}
          />
          <FeatureCard
            icon={<MessageCircleHeart className="text-[var(--color-brand)]" />}
            title={tLanding("features.chat.title")}
            body={tLanding("features.chat.body")}
          />
          <FeatureCard
            icon={<Stethoscope className="text-[var(--color-accent)]" />}
            title={tLanding("features.doctor.title")}
            body={tLanding("features.doctor.body")}
          />
        </div>
      </section>

      {/* CTAs */}
      <section className="px-5 pb-10 mt-auto">
        <div className="flex flex-col gap-3 max-w-md mx-auto w-full">
          <Button asChild size="lg" block>
            <Link href={`/${locale}/onboarding`}>{tLanding("cta_start")}</Link>
          </Button>
          <Button asChild variant="ghost" size="md" block>
            <Link href={`/${locale}/doctor`}>{tLanding("cta_doctor")}</Link>
          </Button>
        </div>
        <p className="text-center text-xs text-[var(--color-slate-400)] mt-4">
          {tBrand("name")} · MindTech · CAU Tashkent
        </p>
      </section>
    </main>
  );
}

function TrustBadge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)] font-medium">
      {icon}
      {children}
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="card flex flex-col gap-2">
      <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-soft)] flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-heading font-bold">{title}</h3>
      <p className="text-sm text-[var(--color-slate-500)] leading-relaxed">{body}</p>
    </article>
  );
}

function LanguageSwitcher({ current }: { current: string }) {
  const labels = { uz: "🇺🇿 UZ", ru: "🇷🇺 RU", en: "🇬🇧 EN" } as const;
  return (
    <div className="flex items-center gap-1 bg-[var(--color-mist)] rounded-full p-0.5 text-xs font-medium">
      {(["uz", "ru", "en"] as const).map((l) => (
        <Link
          key={l}
          href={`/${l}`}
          className={`px-3 py-1.5 rounded-full transition-all ${
            l === current
              ? "bg-white text-[var(--color-ink)] shadow-sm"
              : "text-[var(--color-slate-500)] hover:text-[var(--color-ink)]"
          }`}
        >
          {labels[l]}
        </Link>
      ))}
    </div>
  );
}
