"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CustomerPage } from "@/components/shell";
import { Badge, Card, ErrorNote, PageFade, TradeIcon } from "@/components/ui";
import { post, rs, TRADES } from "@/lib/api";

type Diagnosis = { trade: string; issue: string; confidence: number; priceMin: number; priceMax: number; basis: string };

function Diagnose() {
  const q = useSearchParams().get("q") ?? "";
  const [d, setD] = useState<Diagnosis>();
  const [err, setErr] = useState<string>();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!q) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, 3)), 350);
    post<Diagnosis>("/ai/diagnose", { text: q })
      .then((r) => setTimeout(() => setD(r), 900))
      .catch((e) => setErr(e.message));
    return () => clearInterval(t);
  }, [q]);

  const trade = TRADES.find((t) => t.key === d?.trade);

  return (
    <PageFade className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold text-ink-2">You said</p>
      <h1 className="mt-1 text-2xl font-extrabold">“{q}”</h1>
      <ErrorNote error={err} />
      {!d && !err && (
        <Card className="relative mt-6 overflow-hidden">
          <motion.div className="absolute inset-x-0 h-0.5 bg-ai" animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 2, repeat: Infinity }} />
          <p className="flex items-center gap-2 font-bold text-ai"><Sparkles className="h-5 w-5" /> AI is analysing your problem…</p>
          {["Understanding the problem", "Matching the right trade", "Checking fair prices nearby"].map((s, i) => (
            <p key={s} className="mt-3 flex items-center gap-2 text-sm">
              <span className={`grid h-5 w-5 place-items-center rounded-full ${step > i ? "bg-teal text-white" : "bg-line"}`}>{step > i && <Check className="h-3 w-3" />}</span>
              {s}
            </p>
          ))}
        </Card>
      )}
      {d && trade && (
        <PageFade>
          <Card className="mt-6 border-ai/30">
            <div className="flex items-center gap-4">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${trade.tone}`}><TradeIcon icon={trade.icon} className="h-7 w-7" /></span>
              <div className="flex-1">
                <Badge tone="ai"><Sparkles className="h-3 w-3" /> AI diagnosis · {Math.round(d.confidence * 100)}% sure</Badge>
                <p className="mt-1 text-xl font-extrabold">You need a {trade.en}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-ai-50 p-4">
              <p className="text-sm font-semibold text-ai">Fair price for this job</p>
              <p className="mt-1 text-3xl font-extrabold">{rs(d.priceMin)} – {rs(d.priceMax)}</p>
              <p className="mt-1 text-xs text-ink-2">Based on {d.basis}. Agree on the final price in chat.</p>
            </div>
            <p className="mt-4 text-sm text-ink-2">🔊 The worker will hear your request read aloud in Urdu.</p>
            <Link href={`/c/workers?trade=${d.trade}&q=${encodeURIComponent(q)}`} className="mt-5 flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-brand font-bold text-white">
              See available {trade.en}s <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
          <p className="mt-4 text-center text-sm text-ink-2">
            Not right? Pick a trade:{" "}
            {TRADES.map((t) => (
              <Link key={t.key} href={`/c/workers?trade=${t.key}&q=${encodeURIComponent(q)}`} className="mx-1 font-semibold underline">{t.en}</Link>
            ))}
          </p>
        </PageFade>
      )}
    </PageFade>
  );
}

export default function Page() {
  return (
    <CustomerPage>
      <Suspense>
        <Diagnose />
      </Suspense>
    </CustomerPage>
  );
}
