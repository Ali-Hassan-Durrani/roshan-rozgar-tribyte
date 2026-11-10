"use client";

import { Camera, Check, Clock, IdCard, Mic, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkerShell } from "@/components/shell";
import { Button, Card, cx, DemoTag, ErrorNote, ListenButton, MicRecorder, PageFade, Skeleton } from "@/components/ui";
import { VoiceAgent } from "@/components/voice-agent";
import { mediaUrl, post, put, SECTORS, shrinkImage, TRADES, useApi } from "@/lib/api";
import { T, useLang } from "@/lib/i18n";
import { Line, transcriptText, VAPI_WORKER, vapiEnabled } from "@/lib/vapi";

type Profile = { name: string; trade: string; experienceYears: number; areas: string[]; baseRate: number; workHours: string; voiceTranscript?: string };

export default function Onboarding() {
  const router = useRouter();
  const { data: me, reload } = useApi<any>("/workers/me");
  const [err, setErr] = useState<string>();
  const { t, ur } = useLang();

  useEffect(() => {
    if (me?.status === "VERIFIED") router.replace("/w");
  }, [me, router]);
  if (!me) return <WorkerShell><Skeleton className="h-96" /></WorkerShell>;

  if (me.status === "PENDING_REVIEW") {
    return (
      <WorkerShell>
        <PageFade>
          <Card className="text-center">
            <Clock className="mx-auto h-16 w-16 text-amber" />
            <h1 className="mt-4 text-3xl font-bold"><T en="Your profile is being reviewed" ur="آپ کی پروفائل جانچ میں ہے" /></h1>
            <p className="mt-2 text-lg text-ink-2"><T en="You can take jobs once an admin approves you." ur="ایڈمن منظوری کے بعد آپ کام لے سکیں گے۔" /></p>
            <p className="mt-1 text-sm text-ink-3" dir="ltr">Waiting for admin approval</p>
            <div className="mt-4 flex justify-center">
              <ListenButton
                text={t("Your profile is being reviewed. You can take jobs once an admin approves you.", "آپ کی پروفائل جانچ میں ہے۔ ایڈمن منظوری کے بعد آپ کام لے سکیں گے۔")}
                lang={ur ? "UR" : "EN"}
                label={t("Listen", "سنیں")}
              />
            </div>
            <Button kind="ghost" className="mt-6" onClick={reload}>{t("Refresh", "دوبارہ دیکھیں")}</Button>
          </Card>
        </PageFade>
      </WorkerShell>
    );
  }

  const c = me.completeness;
  const steps = [
    ["profile", t("Voice profile", "آواز سے پروفائل"), Mic],
    ["photo", t("Photo", "تصویر"), Camera],
    ["cnic", t("CNIC", "شناختی کارڈ"), IdCard],
  ] as const;
  const current = steps.find(([k]) => !c[k])?.[0] ?? "submit";

  const submit = async () => {
    try {
      await post("/workers/me/submit");
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <WorkerShell>
      <PageFade className="space-y-5">
        <h1 className="text-3xl font-bold"><T en="Create your profile" ur="اپنی پروفائل بنائیں" /></h1>
        {me.status === "REJECTED" && <ErrorNote error={`Rejected: ${me.rejectReason ?? "please fix and resubmit"}`} />}
        <div className="flex gap-2">
          {steps.map(([k, l, I]) => (
            <div key={k} className={cx("flex flex-1 items-center gap-2 rounded-2xl p-3", c[k] ? "bg-[#E6F6F4] text-teal" : current === k ? "bg-brand text-white" : "bg-white text-ink-3")}>
              {c[k] ? <Check className="h-5 w-5" /> : <I className="h-5 w-5" />}
              <span className={cx("text-sm", ur && "urdu")}>{l}</span>
            </div>
          ))}
        </div>
        <ProfileStep me={me} done={c.profile} onSaved={reload} />
        {c.profile && <PhotoStep me={me} onSaved={reload} />}
        {c.profile && <CnicStep me={me} onSaved={reload} />}
        <ErrorNote error={err} />
        {current === "submit" && (
          <Button size="XL" className="w-full" icon={<ShieldCheck className="h-6 w-6" />} onClick={submit}>
            <span ><T en="Send for approval" ur="منظوری کے لیے بھیجیں" /></span>
          </Button>
        )}
      </PageFade>
    </WorkerShell>
  );
}

function ProfileStep({ me, done, onSaved }: { me: any; done: boolean; onSaved: () => void }) {
  const [p, setP] = useState<Profile>({
    name: me.name ?? "",
    trade: me.trade ?? "ELECTRICIAN",
    experienceYears: me.experienceYears ?? 1,
    areas: me.areas?.length ? me.areas : ["G-10"],
    baseRate: me.baseRate ?? 800,
    workHours: me.workHours ?? "9am - 7pm",
  });
  const [editing, setEditing] = useState(!done);
  const [transcript, setTranscript] = useState<string>();
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<string>();
  const [saving, setSaving] = useState(false);
  const { t, ur } = useLang();

  // AI extraction → nothing is saved until the worker confirms every field (W4).
  const fill = async (text: string) => {
    setTranscript(text);
    const x = await post<any>("/ai/extract-profile", { transcript: text });
    setP((old) => ({
      ...old,
      ...(x.name ? { name: x.name } : {}),
      ...(x.trade ? { trade: x.trade } : {}),
      ...(x.experienceYears != null ? { experienceYears: x.experienceYears } : {}),
      ...(x.areas?.length ? { areas: x.areas } : {}),
      ...(x.baseRate ? { baseRate: x.baseRate } : {}),
      ...(x.workHours ? { workHours: x.workHours } : {}),
      voiceTranscript: text,
    }));
  };

  // Vapi agent finished: the whole conversation goes to extraction.
  const onAgentEnd = async (lines: Line[]) => {
    if (!lines.some((l) => l.role === "user")) return;
    setListening(true);
    setErr(undefined);
    try {
      await fill(transcriptText(lines));
    } catch {
      setErr(t("Couldn't build the profile — please fill it in below", "پروفائل نہیں بن سکی — نیچے خود بھریں"));
    } finally {
      setListening(false);
    }
  };

  // Fallback voice flow: record → ElevenLabs STT → AI extraction.
  const onVoice = async (_: string, blob: Blob) => {
    setListening(true);
    setErr(undefined);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      fd.append("lang", "ur");
      const { text } = await post<{ text: string }>("/voice/stt", fd);
      await fill(text);
    } catch {
      setErr(t("Voice service unavailable — please fill it in below", "آواز سروس دستیاب نہیں — نیچے خود بھریں"));
    } finally {
      setListening(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(undefined);
    try {
      await put("/workers/me/profile", { ...p, experienceYears: Number(p.experienceYears), baseRate: Number(p.baseRate) });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Card className="flex items-center justify-between">
        <div dir="ltr">
          <p className="font-bold">{p.name} · {TRADES.find((t) => t.key === p.trade)?.en}</p>
          <p className="text-sm text-ink-2">{p.experienceYears} yrs · Rs {p.baseRate} · {p.areas.join(", ")}</p>
        </div>
        <Button kind="ghost" onClick={() => setEditing(true)}><span ><T en="Edit" ur="تبدیل کریں" /></span></Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-brand-50 p-6 text-center">
        <p className="text-xl font-bold"><T en="Tap the mic — our assistant will ask you a few questions" ur="مائیک دبائیں — ہماری اسسٹنٹ آپ سے سوال پوچھے گی" /></p>
        {vapiEnabled ? (
          <VoiceAgent
            assistantId={VAPI_WORKER}
            purpose="WORKER_ONBOARDING"
            urdu={ur}
            onEnd={onAgentEnd}
            idleLabel={listening ? <T en="Building your profile…" ur="پروفائل بن رہی ہے…" /> : <T en="Tap to start talking" ur="بات شروع کرنے کے لیے دبائیں" />}
          />
        ) : (
          <MicRecorder
            size={88}
            onDone={onVoice}
            label={<span className="text-sm text-ink-2">{listening ? <T en="Listening…" ur="سن رہے ہیں…" /> : <T en="Tap to speak" ur="بولنے کے لیے دبائیں" />}</span>}
          />
        )}
        {vapiEnabled && (
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <MicRecorder size={40} onDone={onVoice} />
            <span ><T en="Or record one message: name, trade, years, area, rate" ur="یا ایک پیغام ریکارڈ کریں: نام، کام، سال، علاقہ، ریٹ" /></span>
          </div>
        )}
        {transcript && <p className="max-h-32 overflow-y-auto whitespace-pre-line rounded-2xl bg-white p-3 text-left text-xs" dir="auto">{transcript}</p>}
      </div>
      <p className="text-lg font-bold"><T en="Is this correct?" ur="کیا یہ ٹھیک ہے؟" /></p>
      <div className="grid gap-3 md:grid-cols-2" dir="ltr">
        <Field label="نام · Name"><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className="h-14 w-full rounded-xl border border-line px-3 text-lg" /></Field>
        <Field label="کام · Trade">
          <select value={p.trade} onChange={(e) => setP({ ...p, trade: e.target.value })} className="h-14 w-full rounded-xl border border-line px-3 text-lg">
            {TRADES.map((t) => <option key={t.key} value={t.key}>{t.en} — {t.ur}</option>)}
          </select>
        </Field>
        <Field label="تجربہ (سال) · Years"><input type="number" min={0} max={60} value={p.experienceYears} onChange={(e) => setP({ ...p, experienceYears: Number(e.target.value) })} className="h-14 w-full rounded-xl border border-line px-3 text-lg" /></Field>
        <Field label="ریٹ (روپے) · Base rate"><input type="number" min={100} value={p.baseRate} onChange={(e) => setP({ ...p, baseRate: Number(e.target.value) })} className="h-14 w-full rounded-xl border border-line px-3 text-lg" /></Field>
        <Field label="علاقہ · Area">
          <select value={p.areas[0]} onChange={(e) => setP({ ...p, areas: [e.target.value] })} className="h-14 w-full rounded-xl border border-line px-3 text-lg">
            {SECTORS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="اوقات · Hours"><input value={p.workHours} onChange={(e) => setP({ ...p, workHours: e.target.value })} className="h-14 w-full rounded-xl border border-line px-3 text-lg" /></Field>
      </div>
      <ErrorNote error={err} />
      <Button size="XL" className="w-full" loading={saving} onClick={save}><span ><T en="Yes, that's right" ur="جی ہاں، ٹھیک ہے" /></span></Button>
    </Card>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-sm text-ink-2">{label}</span>
    {children}
  </label>
);

function PhotoStep({ me, onSaved }: { me: any; onSaved: () => void }) {
  const [err, setErr] = useState<string>();
  const upload = async (path: string, f?: File) => {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", await shrinkImage(f));
    try {
      await post(path, fd);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card className="space-y-3">
      <p className="text-xl font-bold"><T en="Your photo and work photos" ur="اپنی تصویر اور کام کی تصویریں" /></p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-full border-2 border-dashed border-line bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {me.photoMediaId ? <img src={mediaUrl(me.photoMediaId)} alt="" className="h-full w-full object-cover" /> : <><UserRound className="h-8 w-8 text-ink-3" /><span className="text-xs"><T en="Face" ur="چہرہ" /></span></>}
          <input type="file" accept="image/jpeg,image/png" capture="user" className="hidden" onChange={(e) => upload("/workers/me/photo", e.target.files?.[0])} />
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {me.workPhotoIds.map((id: string) => <img key={id} src={mediaUrl(id)} alt="" className="h-24 w-24 rounded-2xl object-cover" />)}
        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-bg">
          <Camera className="h-6 w-6 text-ink-3" /><span className="text-xs"><T en="Work photo" ur="کام کی تصویر" /></span>
          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => upload("/workers/me/work-photos", e.target.files?.[0])} />
        </label>
      </div>
      <p className="text-xs text-ink-3" dir="ltr">JPEG/PNG, max 5 MB</p>
      <ErrorNote error={err} />
    </Card>
  );
}

function CnicStep({ me, onSaved }: { me: any; onSaved: () => void }) {
  const [front, setFront] = useState<File>();
  const [back, setBack] = useState<File>();
  const [res, setRes] = useState<any>(me.cnic ? { ok: true, checks: me.cnic.checks, masked: me.cnic.masked } : null);
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const check = async () => {
    if (!front || !back) return;
    setLoading(true);
    setErr(undefined);
    try {
      const fd = new FormData();
      fd.append("front", await shrinkImage(front));
      fd.append("back", await shrinkImage(back));
      const r = await post("/workers/me/cnic", fd);
      setRes(r);
      if (r.ok) onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const LABEL: Record<string, string> = { format: "CNIC format", frontBackMatch: "Front = back", notExpired: "Not expired", adult: "18+", nameMatch: "Name matches", quality: "Clear photo", unique: "Not used before" };
  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 text-xl font-bold"><T en="CNIC (front and back)" ur="شناختی کارڈ (آگے اور پیچھے)" /> <DemoTag /></p>
      <p className="text-xs text-ink-2" dir="ltr">ID verification is demo — not checked against NADRA. The number is stored encrypted.</p>
      <div className="grid grid-cols-2 gap-3">
        {([["Front", "آگے", front, setFront], ["Back", "پیچھے", back, setBack]] as const).map(([en, l, f, set]) => (
          <label key={en} className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-2 border-dashed border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f ? <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" /> : <><IdCard className="h-8 w-8 text-ink-3" /><T en={en} ur={l} /></>}
            <input type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={(e) => set(e.target.files?.[0])} />
          </label>
        ))}
      </div>
      <Button size="XL" className="w-full" loading={loading} disabled={!front || !back} onClick={check}><span ><T en="Check card" ur="کارڈ چیک کریں" /></span></Button>
      {res && (
        <div dir="ltr" className="space-y-2">
          {res.masked && <p className="font-bold">CNIC {res.masked}</p>}
          <div className="flex flex-wrap gap-2">
            {Object.entries(res.checks ?? {}).map(([k, v]) => (
              <span key={k} className={cx("rounded-full px-3 py-1 text-xs font-semibold", v ? "bg-[#E6F6F4] text-teal" : "bg-danger-50 text-danger")}>{v ? "✓" : "✕"} {LABEL[k] ?? k}</span>
            ))}
          </div>
          {!res.ok && <p className="text-danger"><T en="The card wasn't clear. Please take the photo again." ur="کارڈ صاف نظر نہیں آیا۔ دوبارہ تصویر لیں۔" /></p>}
        </div>
      )}
      <ErrorNote error={err} />
    </Card>
  );
}
