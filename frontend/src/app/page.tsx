"use client";

import { ArrowRight, Camera, Mic, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequestModal } from "@/components/request-modal";
import { CustomerNav, useMe } from "@/components/shell";
import { Avatar, Badge, Card, MicRecorder, Modal, PageFade, Skeleton, TradeIcon, TruckStrip } from "@/components/ui";
import { VoiceAgent } from "@/components/voice-agent";
import { WorkerCard, WorkerCardData } from "@/components/worker-card";
import { post, TRADES, useApi } from "@/lib/api";
import { userText, VAPI_CUSTOMER, vapiEnabled } from "@/lib/vapi";

const TRIES = ["AC thanda nahi kar raha", "Switch se chingari", "Darwaza band nahi hota"];

export default function Home() {
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [talk, setTalk] = useState(false);
  const [req, setReq] = useState<WorkerCardData | null>(null);
  const { data } = useApi<{ workers: WorkerCardData[] }>("/workers/search?radiusKm=50", 10_000);
  const workers = data?.workers ?? [];
  const available = workers.filter((w) => w.availability === "AVAILABLE");

  const find = (text = q) => {
    if (!text.trim()) return;
    if (me?.role === "WORKER") return router.push("/w");
    router.push(`/c/diagnose?q=${encodeURIComponent(text)}`);
  };

  const onVoice = async (id: string, blob: Blob) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      const r = await post<{ text: string }>("/voice/stt", fd);
      setQ(r.text);
      find(r.text);
    } catch {
      alert("Voice service not available — please type instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <CustomerNav />
      <section className="hero-grad text-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 md:grid-cols-[1.1fr_1fr] md:px-16 md:py-16">
          <PageFade>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
              <span className="h-2 w-2 rounded-full bg-ink" /> Live in Islamabad &amp; Rawalpindi · {available.length} workers online
            </span>
            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.08] tracking-[-0.02em] md:text-[52px]">
              Something broken? Get a trusted worker at your door — fast.
            </h1>
            <p className="mt-5 max-w-xl text-brand-100 md:text-lg">
              Describe it in English or Roman Urdu, speak it, or snap a photo. Our AI finds the right trade, a fair price and who is free right now.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); find(); }} className="mt-7 flex items-center gap-2 rounded-2xl bg-white p-2 text-ink md:max-w-[640px]">
              <Search className="ml-3 h-5 w-5 shrink-0 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kitchen ka nalka leak ho raha hai…" className="min-w-0 flex-1 bg-transparent p-2 outline-none" />
              {me && vapiEnabled && (
                <button type="button" onClick={() => setTalk(true)} className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50" aria-label="Talk to the assistant">
                  <Mic className="h-5 w-5" />
                </button>
              )}
              {me && !vapiEnabled && <MicRecorder size={44} onDone={onVoice} />}
              {!me && (
                <Link href="/login" className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50" aria-label="Speak (log in)">
                  <Mic className="h-5 w-5" />
                </Link>
              )}
              <Link href={me ? "/c/diagnose?photo=1" : "/login"} className="hidden h-11 w-11 place-items-center rounded-xl bg-brand-50 md:grid" aria-label="Photo">
                <Camera className="h-5 w-5" />
              </Link>
              <button className="flex h-11 items-center gap-2 rounded-xl bg-amber px-5 font-bold">
                {busy ? "Listening…" : "Find help"} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-brand-100">Try:</span>
              {TRIES.map((t) => (
                <button key={t} onClick={() => { setQ(t); find(t); }} className="rounded-full border border-white/60 px-3 py-1.5 font-medium hover:bg-white/10">
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-8">
              {[
                ["4.8★", "average rating"],
                ["12 min", "average arrival"],
                ["100%", "phone-verified workers"],
              ].map(([a, b]) => (
                <div key={b}>
                  <p className="text-2xl font-extrabold text-amber md:text-3xl">{a}</p>
                  <p className="text-xs text-brand-100 md:text-sm">{b}</p>
                </div>
              ))}
            </div>
          </PageFade>
          <MiniMap workers={workers.slice(0, 5)} />
        </div>
        <TruckStrip />
      </section>

      <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-extrabold md:text-[28px]">What do you need fixed?</h2>
          <Link href="/c/workers" className="text-sm font-bold">All services →</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-6">
          {TRADES.map((t) => (
            <Link key={t.key} href={`/c/workers?trade=${t.key}`} className="rounded-3xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-card">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${t.tone}`}>
                <TradeIcon icon={t.icon} className="h-6 w-6" />
              </span>
              <p className="mt-4 font-bold">{t.en}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full bg-ink" /> {available.filter((w) => w.trade === t.key).length} available now
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-14 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold md:text-[28px]">Available near you · G-10, Islamabad</h2>
          <Link href="/c/workers" className="text-sm font-bold">See all {available.length} →</Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {!data && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
          {available.slice(0, 4).map((w) => <WorkerCard key={w.id} w={w} onRequest={setReq} />)}
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            [ShieldCheck, "Verified workers", "Phone OTP + ID check (mocked for demo) before a worker can take jobs.", "bg-info-50 text-info"],
            [Users, "Reviews from real neighbours", "Only customers who booked can review — spoken or typed, summarised by AI.", "bg-amber-50 text-busy"],
            [Sparkles, "Fair price before you book", "AI estimates a price range from similar jobs in your area.", "bg-ai-50 text-ai"],
          ].map(([I, t, d, tone]: any) => (
            <Card key={t} className="p-6">
              <span className={`grid h-12 w-12 place-items-center rounded-xl ${tone}`}><I className="h-6 w-6" /></span>
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm text-ink-2">{d}</p>
            </Card>
          ))}
        </div>
        {!me && (
          <p className="mt-10 text-center text-sm text-ink-2">
            Are you a skilled worker? <Link href="/login?role=WORKER" className="font-bold text-brand underline">Join as a worker →</Link>
          </p>
        )}
      </main>
      <footer className="bg-ink py-8 text-sm text-white/70">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 md:px-16">
          <span>© Roshan Rozgar · Team TriByte · CUI Tech Fest 2026</span>
          <span className="urdu text-xl text-amber">روزگار روشن</span>
        </div>
      </footer>
      <RequestModal worker={req} onClose={() => setReq(null)} />
      <Modal open={talk} onClose={() => setTalk(false)} title="Tell us what's wrong">
        <p className="mb-4 text-sm text-ink-2">Speak in English, Roman Urdu or Urdu. The assistant asks what&apos;s broken, how urgent it is and where you are.</p>
        <VoiceAgent
          assistantId={VAPI_CUSTOMER}
          purpose="CUSTOMER_BOOKING"
          idleLabel="Tap to start talking"
          onEnd={(lines) => {
            const said = userText(lines);
            setTalk(false);
            if (said) find(said);
          }}
        />
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-line pt-4 text-sm text-ink-2">
          <MicRecorder size={40} onDone={(id, blob) => { setTalk(false); onVoice(id, blob); }} /> Or record a quick voice note
        </div>
      </Modal>
    </div>
  );
}

function MiniMap({ workers }: { workers: WorkerCardData[] }) {
  const pos = [[18, 22], [62, 28], [12, 58], [58, 68], [80, 50]];
  const top = workers.find((w) => w.availability === "AVAILABLE");
  return (
    <div className="relative hidden h-[420px] overflow-hidden rounded-3xl bg-[#2A2F66] md:block">
      {[[0, 25], [0, 52], [0, 78]].map(([, y]) => <div key={y} className="absolute inset-x-0 h-2 bg-white/90" style={{ top: `${y}%` }} />)}
      {[30, 70].map((x) => <div key={x} className="absolute inset-y-0 w-2 bg-white/90" style={{ left: `${x}%` }} />)}
      <span className="absolute left-[44%] top-[38%] flex items-center gap-1.5 rounded-full bg-info px-3 py-1.5 text-xs font-bold">You</span>
      {workers.map((w, i) => (
        <span key={w.id} className={`absolute flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${w.availability === "AVAILABLE" ? "bg-ink" : "bg-busy"}`} style={{ left: `${pos[i][0]}%`, top: `${pos[i][1]}%` }}>
          {w.availability === "AVAILABLE" ? `${w.name.split(" ")[0]} · ${w.distanceKm} km` : "Busy"}
        </span>
      ))}
      {top && (
        <div className="absolute bottom-4 left-4 right-24 flex items-center gap-3 rounded-2xl bg-white p-4 text-ink shadow-modal">
          <Avatar name={top.name} photoId={top.photoMediaId} />
          <div className="flex-1">
            <p className="font-bold">{top.name}</p>
            <p className="text-xs text-ink-2">{top.distanceKm} km · {top.etaMin} min</p>
          </div>
          <Badge dot>Available</Badge>
        </div>
      )}
    </div>
  );
}
