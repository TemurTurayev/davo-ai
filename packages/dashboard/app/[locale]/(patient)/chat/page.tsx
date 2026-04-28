import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { SideEffectChat } from "@/components/chat/side-effect-chat";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <SideEffectChat locale={locale} />;
}
