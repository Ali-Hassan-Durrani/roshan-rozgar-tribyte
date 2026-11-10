"use client";

import { MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RequestModal } from "@/components/request-modal";
import { CustomerPage } from "@/components/shell";
import { Avatar, Badge, Button, Card, PageFade, Skeleton, Stars, Verified, VoicePlayer } from "@/components/ui";
import { mediaUrl, rs, tradeName, useApi } from "@/lib/api";
import { T } from "@/lib/i18n";

export default function WorkerProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: w } = useApi<any>(`/workers/${id}`, 5000);
  const [open, setOpen] = useState(false);
  if (!w) return <CustomerPage><Skeleton className="h-96" /></CustomerPage>;
  const busy = w.availability !== "AVAILABLE";
  const aspects: [string, number | null][] = [
    ["Quality of work", w.aspects.quality],
    ["On time", w.aspects.onTime],
    ["Fair price", w.aspects.fairPrice],
    ["Behaviour", w.aspects.behaviour],
  ];
  return (
    <CustomerPage>
      <PageFade className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="flex flex-col gap-5 md:flex-row md:items-center">
            <Avatar name={w.name} photoId={w.photoMediaId} size={96} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-[28px] font-extrabold">{w.name}</h1>
                <Verified />
              </div>
              <p className="text-ink-2">{tradeName(w.trade)} · {w.experienceYears} yrs experience</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Stars value={w.ratingAvg} count={w.ratingCount} />
                <span className="text-sm text-ink-2">{w.jobsDone} jobs done</span>
                <span className="flex items-center gap-1 text-sm text-ink-2"><MapPin className="h-4 w-4" /> {w.areas.join(", ")}</span>
              </div>
            </div>
            {busy ? <Badge tone="busy" dot>Busy on a job</Badge> : <Badge dot>Available now</Badge>}
          </Card>
          {w.aiSummary && (
            <Card className="border-ai/30 bg-ai-50">
              <p className="flex items-center gap-2 text-sm font-bold text-ai"><Sparkles className="h-4 w-4" /> AI summary of {w.ratingCount} reviews</p>
              <p className="mt-2">{w.aiSummary}</p>
            </Card>
          )}
          <Card>
            <h2 className="text-lg font-bold"><T en="Ratings by aspect" ur="ریٹنگ تفصیل سے" /></h2>
            <div className="mt-4 space-y-3">
              {aspects.map(([label, v]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="w-36">{label}</span>
                  <div className="h-2 flex-1 rounded-full bg-bg">
                    <div className="h-2 rounded-full bg-amber" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                  </div>
                  <b className="w-8 text-right">{v ?? "—"}</b>
                </div>
              ))}
            </div>
          </Card>
          {!!w.workPhotoIds.length && (
            <Card>
              <h2 className="text-lg font-bold"><T en="Work photos" ur="کام کی تصاویر" /></h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.workPhotoIds.map((p: string) => <img key={p} src={mediaUrl(p)} alt="" className="aspect-square rounded-2xl object-cover" />)}
              </div>
            </Card>
          )}
          <Card>
            <h2 className="text-lg font-bold"><T en="Recent reviews" ur="حالیہ ریویوز" /></h2>
            <div className="mt-3 divide-y divide-line">
              {w.reviews.map((r: any) => (
                <div key={r.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <b>{r.customerName}</b>
                    <Stars value={r.overall} />
                  </div>
                  {r.voiceId && <div className="mt-2"><VoicePlayer mediaId={r.voiceId} /></div>}
                  {(r.text || r.transcript) && <p className="mt-2 text-sm text-ink-2">{r.text || r.transcript}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">{r.tags.map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
                </div>
              ))}
              {!w.reviews.length && <p className="py-4 text-sm text-ink-2"><T en="No reviews yet." ur="ابھی کوئی ریویو نہیں۔" /></p>}
            </div>
          </Card>
        </div>
        <div>
          <Card className="sticky top-24">
            <p className="text-sm text-ink-2"><T en="Starting from" ur="شروع" /></p>
            <p className="text-3xl font-extrabold">{rs(w.baseRate)}</p>
            <p className="mt-1 text-sm text-ink-2">{w.workHours}</p>
            <Button size="L" className="mt-5 w-full" disabled={busy} onClick={() => setOpen(true)}>
              {busy ? "Busy right now" : "Request " + w.name.split(" ")[0]}
            </Button>
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-2">
              <ShieldCheck className="h-4 w-4 text-info" /> Phone verified · ID checked (demo, not NADRA)
            </p>
          </Card>
        </div>
      </PageFade>
      <RequestModal worker={open ? w : null} onClose={() => setOpen(false)} />
    </CustomerPage>
  );
}
