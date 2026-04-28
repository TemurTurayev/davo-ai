import { setRequestLocale } from "next-intl/server";
import { isValidLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { AIAssistantChat } from "@/components/assistant/ai-assistant-chat";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AssistantPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  return <AIAssistantChat locale={locale} />;
}
