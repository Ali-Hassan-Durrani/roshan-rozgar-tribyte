"use client";

import { Lock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, patch, post, rs, SECTORS, tradeName } from "@/lib/api";
import { T } from "@/lib/i18n";
import { useMe } from "./shell";
import { Avatar, Button, ErrorNote, MicRecorder, Modal } from "./ui";
import type { WorkerCardData } from "./worker-card";

/** CM3 confirm request (+ CM6 when the worker just got booked). */
export function RequestModal({ worker, onClose, problem }: { worker: WorkerCardData | null; onClose: () => void; problem?: string }) {
  const router = useRouter();
  const { data: me } = useMe();
  const [text, setText] = useState(problem ?? "");
  const [voiceId, setVoiceId] = useState<string>();
  const [urgency, setUrgency] = useState<"NOW" | "TODAY" | "SCHEDULED">("NOW");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("G-10");
  const [price, setPrice] = useState<{ priceMin: number; priceMax: number }>();
  const [err, setErr] = useState<string>();
  const [taken, setTaken] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (problem) setText(problem);
  }, [problem]);
  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setAddress(me.customer?.address ?? "");
      setArea(me.customer?.area ?? "G-10");
    }
  }, [me]);
  useEffect(() => {
    if (!worker || !me) return;
    post("/ai/diagnose", { text: text || tradeName(worker.trade) }).then(setPrice).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker, me]);

  const submit = async () => {
    if (!worker) return;
    if (!me) return router.push(`/login?next=/c/workers/${worker.id}`);
    setLoading(true);
    setErr(undefined);
    try {
      if (!me.name && name) await patch("/users/me", { name });
      if (!me.customer?.address || me.customer.area !== area) await patch("/customers/me", { address, area });
      const b = await post("/bookings", {
        workerId: worker.id,
        trade: worker.trade,
        problemText: text || `Need a ${tradeName(worker.trade)}`,
        problemVoiceId: voiceId,
        urgency,
        address,
        area,
      });
      router.push(`/c/bookings/${b.id}`);
    } catch (e) {
      if ((e as ApiError).code === "WORKER_UNAVAILABLE") setTaken(true);
      else setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setTaken(false);
    onClose();
  };

  return (
    <Modal open={!!worker} onClose={close} title={taken ? "Worker just got booked" : "Confirm request"}>
      {worker && taken && (
        <div className="space-y-4">
          <p className="text-ink-2">
            {worker.name} accepted another job a moment ago and is now <b className="text-busy"><T en="Busy" ur="مصروف" /></b>. Pick another available worker nearby.
          </p>
          <Button size="L" className="w-full" onClick={() => { close(); router.push(`/c/workers?trade=${worker.trade}`); }}>
            See other {tradeName(worker.trade)}s
          </Button>
        </div>
      )}
      {worker && !taken && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
            <Avatar name={worker.name} photoId={worker.photoMediaId} />
            <div className="flex-1">
              <p className="font-bold">{worker.name}</p>
              <p className="text-sm text-ink-2">{tradeName(worker.trade)} · from {rs(worker.baseRate)}</p>
            </div>
          </div>
          <label className="block text-sm font-semibold">
            <T en="What's the problem?" ur="مسئلہ کیا ہے؟" />
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-line p-3 font-normal" placeholder="Kitchen ka nalka leak ho raha hai…" />
          </label>
          <div className="flex items-center gap-3">
            <MicRecorder size={44} onDone={(id) => setVoiceId(id)} />
            <span className="text-sm text-ink-2">{voiceId ? "Voice note attached ✓ — the worker hears it in Urdu" : "Or speak it (the worker hears it)"}</span>
          </div>
          <div className="flex gap-2">
            {(["NOW", "TODAY", "SCHEDULED"] as const).map((u) => (
              <button key={u} onClick={() => setUrgency(u)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${urgency === u ? "border-brand bg-brand text-white" : "border-line"}`}>
                {u === "NOW" ? "Right now" : u === "TODAY" ? "Today" : "Later"}
              </button>
            ))}
          </div>
          {me && (
            <div className="grid gap-2 md:grid-cols-[1fr_140px]">
              {!me.name && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl border border-line p-3 md:col-span-2" />}
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / street" className="rounded-xl border border-line p-3" />
              <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-xl border border-line p-3">
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          {price && (
            <div className="flex items-center gap-2 rounded-2xl bg-ai-50 p-3 text-sm text-ai">
              <Sparkles className="h-4 w-4" /> AI fair price: <b>{rs(price.priceMin)} – {rs(price.priceMax)}</b>
            </div>
          )}
          <ErrorNote error={err} />
          <Button size="L" className="w-full" loading={loading} onClick={submit}>
            {me ? "Send request" : "Log in to request"}
          </Button>
          <p className="flex items-center gap-2 text-xs text-ink-2">
            <Lock className="h-3.5 w-3.5" /> You agree on the price in chat. Nothing is booked until you both accept.
          </p>
        </div>
      )}
    </Modal>
  );
}
