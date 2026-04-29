/**
 * Locale-aware navigation primitives from next-intl.
 *
 * Use these (`Link`, `useRouter`, `usePathname`) instead of `next/link` and
 * `next/navigation` when you need locale-correct URLs that respect the
 * `as-needed` prefix policy (uz default has no /uz prefix; ru and en do).
 *
 * Example:
 *   import { Link } from "@/i18n/navigation";
 *   <Link href="/profile" locale="uz">UZ</Link>
 *   // generates <a href="/profile"> automatically
 */

import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./config";

export const { Link, useRouter, usePathname, redirect, getPathname } =
  createNavigation({
    locales: locales as unknown as string[],
    defaultLocale,
    localePrefix: "as-needed",
  });
