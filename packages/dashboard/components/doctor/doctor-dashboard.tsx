"use client";

/**
 * Doctor Dashboard — desktop-first (used in browser, not Telegram WebApp).
 * Per UX research: triage by priority, no interruptive popups, role-based view.
 *
 * Sections:
 * 1. Stats hero (total patients, at-risk, review queue)
 * 2. Priority queue: red flags first
 * 3. Patient list with adherence sparklines
 */

import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingDown,
  Activity,
  Users,
  Search,
  Filter,
} from "lucide-react";
import { NafasLogo } from "@/components/brand/nafas-logo";
import { cn } from "@/lib/utils";

interface DemoPatient {
  id: string;
  name: string;
  region: string;
  language: "uz" | "ru";
  treatmentDay: number;
  totalDays: number;
  adherence: number;
  streak: number;
  lastDose: string;
  riskScore: number;
  pendingReviews: number;
  redFlag?: string;
}

const DEMO_PATIENTS: DemoPatient[] = [
  {
    id: "p1",
    name: "Sardor Karimov",
    region: "Toshkent",
    language: "uz",
    treatmentDay: 47,
    totalDays: 180,
    adherence: 0.94,
    streak: 12,
    lastDose: "2 hours ago",
    riskScore: 0.08,
    pendingReviews: 0,
  },
  {
    id: "p2",
    name: "Бекзод Олимов",
    region: "Каракалпакстан",
    language: "ru",
    treatmentDay: 32,
    totalDays: 270,
    adherence: 0.62,
    streak: 0,
    lastDose: "3 days ago",
    riskScore: 0.81,
    pendingReviews: 0,
    redFlag: "3 missed doses in row",
  },
  {
    id: "p3",
    name: "Diyora Tursunova",
    region: "Samarqand",
    language: "uz",
    treatmentDay: 89,
    totalDays: 180,
    adherence: 0.87,
    streak: 6,
    lastDose: "yesterday",
    riskScore: 0.22,
    pendingReviews: 1,
  },
  {
    id: "p4",
    name: "Анвар Юсупов",
    region: "Фергана",
    language: "ru",
    treatmentDay: 21,
    totalDays: 180,
    adherence: 0.95,
    streak: 18,
    lastDose: "today",
    riskScore: 0.10,
    pendingReviews: 0,
  },
  {
    id: "p5",
    name: "Madina Saidova",
    region: "Andijon",
    language: "uz",
    treatmentDay: 124,
    totalDays: 180,
    adherence: 0.78,
    streak: 3,
    lastDose: "today",
    riskScore: 0.42,
    pendingReviews: 2,
    redFlag: "Reported yellow eyes",
  },
];

type FilterType = "all" | "at-risk" | "review";

export function DoctorDashboard({ locale: _locale }: { locale: string }) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const filtered = DEMO_PATIENTS.filter((p) => {
    if (filter === "at-risk" && p.riskScore < 0.5) return false;
    if (filter === "review" && p.pendingReviews === 0) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: DEMO_PATIENTS.length,
    atRisk: DEMO_PATIENTS.filter((p) => p.riskScore >= 0.5).length,
    pending: DEMO_PATIENTS.reduce((s, p) => s + p.pendingReviews, 0),
    redFlags: DEMO_PATIENTS.filter((p) => p.redFlag).length,
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-warm)]">
      {/* Top bar */}
      <header className="bg-white border-b border-[var(--color-slate-200)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <NafasLogo size={32} showWordmark />
          <div className="flex items-center gap-3 text-sm text-[var(--color-slate-500)]">
            <span>Dr. Темур Тураев</span>
            <span className="w-9 h-9 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center font-bold">
              T
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Stat cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<Users size={18} />}
            label="Total patients"
            value={stats.total}
            tone="neutral"
          />
          <StatCard
            icon={<TrendingDown size={18} />}
            label="At-risk (drop-off)"
            value={stats.atRisk}
            tone="danger"
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Pending reviews"
            value={stats.pending}
            tone="warn"
          />
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Red flags"
            value={stats.redFlags}
            tone="danger"
          />
        </section>

        {/* Filters */}
        <section className="card mb-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-slate-400)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patients..."
                className="w-full h-11 pl-10 pr-4 rounded-lg border border-[var(--color-slate-200)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "at-risk", "review"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 h-11 rounded-lg text-sm font-medium transition",
                    filter === f
                      ? "bg-[var(--color-brand)] text-white"
                      : "bg-[var(--color-mist)] text-[var(--color-slate-700)] hover:bg-[var(--color-slate-200)]",
                  )}
                >
                  {f === "all" ? "All" : f === "at-risk" ? "At risk" : "Pending review"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Patient table */}
        <section className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-[var(--color-slate-200)] bg-[var(--color-mist)]/30 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)]">
            <span className="flex-1">Patient</span>
            <span className="w-24 hidden md:block">Region</span>
            <span className="w-24">Adherence</span>
            <span className="w-32 hidden md:block">Last dose</span>
            <span className="w-20">Risk</span>
          </div>
          <ul>
            {filtered.map((p) => (
              <li key={p.id}>
                <button className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--color-mist)]/40 border-b last:border-b-0 border-[var(--color-slate-200)] text-left">
                  <Avatar name={p.name} risk={p.riskScore} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{p.name}</span>
                      {p.language === "uz" && <span className="text-xs">🇺🇿</span>}
                      {p.language === "ru" && <span className="text-xs">🇷🇺</span>}
                    </div>
                    {p.redFlag ? (
                      <p className="text-xs text-[var(--color-danger)] font-medium mt-0.5 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        {p.redFlag}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--color-slate-500)] mt-0.5">
                        Day {p.treatmentDay} of {p.totalDays} · streak {p.streak}d
                      </p>
                    )}
                  </div>
                  <span className="w-24 text-xs text-[var(--color-slate-500)] hidden md:block">
                    {p.region}
                  </span>
                  <div className="w-24">
                    <AdherenceBar pct={p.adherence} />
                  </div>
                  <span className="w-32 text-xs text-[var(--color-slate-500)] hidden md:block tabular">
                    {p.lastDose}
                  </span>
                  <RiskPill score={p.riskScore} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "neutral" | "warn" | "danger";
}) {
  const toneColor = {
    neutral: "var(--color-slate-700)",
    warn: "var(--color-warning)",
    danger: "var(--color-danger)",
  }[tone];
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-slate-500)] mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-3xl font-heading font-extrabold tabular" style={{ color: toneColor }}>
        {value}
      </div>
    </div>
  );
}

function Avatar({ name, risk }: { name: string; risk: number }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const ringColor =
    risk >= 0.7 ? "ring-[var(--color-danger)]" :
    risk >= 0.4 ? "ring-[var(--color-warning)]" :
    "ring-[var(--color-success)]";
  return (
    <div className={cn("w-10 h-10 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center font-bold text-sm shrink-0 ring-2", ringColor)}>
      {initials}
    </div>
  );
}

function AdherenceBar({ pct }: { pct: number }) {
  const p = Math.round(pct * 100);
  const color =
    pct >= 0.85 ? "var(--color-success)" :
    pct >= 0.65 ? "var(--color-warning)" :
    "var(--color-danger)";
  return (
    <div>
      <div className="text-xs font-bold tabular" style={{ color }}>
        {p}%
      </div>
      <div className="h-1.5 bg-[var(--color-mist)] rounded-full overflow-hidden mt-1">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function RiskPill({ score }: { score: number }) {
  const label = score >= 0.7 ? "HIGH" : score >= 0.4 ? "MED" : "LOW";
  const bg = score >= 0.7
    ? "bg-red-100 text-red-700"
    : score >= 0.4
    ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700";
  return (
    <span className={cn("w-20 text-center py-1 rounded-full text-xs font-bold tabular", bg)}>
      {label} · {Math.round(score * 100)}%
    </span>
  );
}
