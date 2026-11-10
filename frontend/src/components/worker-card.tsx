"use client";

import { Clock, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { rs, tradeName } from "@/lib/api";
import { Avatar, Badge, Stars, Verified, cx } from "./ui";

export type WorkerCardData = {
  id: string;
  name: string;
  trade: string;
  experienceYears: number;
  baseRate: number;
  availability: string;
  ratingAvg: number;
  ratingCount: number;
  jobsDone: number;
  photoMediaId?: string | null;
  distanceKm?: number;
  etaMin?: number;
  areas?: string[];
};

export function WorkerCard({ w, onRequest }: { w: WorkerCardData; onRequest?: (w: WorkerCardData) => void }) {
  const busy = w.availability !== "AVAILABLE";
  return (
    <div className={cx("flex gap-4 rounded-3xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5", busy && "opacity-60")}>
      <Avatar name={w.name} photoId={w.photoMediaId} size={64} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-lg font-bold">{w.name}</h3>
          <Verified />
        </div>
        <p className="text-sm text-ink-2">
          {tradeName(w.trade)} · {w.experienceYears} yrs
        </p>
        <Stars value={w.ratingAvg} count={w.ratingCount} />
        <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-2">
          {w.distanceKm != null && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {w.distanceKm} km · {w.etaMin} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Replies in ~3 min
          </span>
        </p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-ai-50 px-2 py-0.5 text-xs font-medium text-ai">
          <Sparkles className="h-3 w-3" /> {w.jobsDone} jobs done nearby
        </span>
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        {busy ? <Badge tone="busy" dot>Busy</Badge> : <Badge dot>Available</Badge>}
        <div className="text-right">
          <p className="text-xl font-extrabold">{rs(w.baseRate)}</p>
          <p className="text-xs text-ink-3">starting</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/c/workers/${w.id}`} className="rounded-xl border border-line px-3 py-2 text-sm font-bold">
            View
          </Link>
          {onRequest && (
            <button disabled={busy} onClick={() => onRequest(w)} className="rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
              Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
