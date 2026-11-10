"use client";

import { Briefcase, Home, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, cx, DemoTag, ErrorNote, Logo, PageFade, TruckStrip } from "@/components/ui";
import { post } from "@/lib/api";
import { LangToggle, T, useLang } from "@/lib/i18n";

const DEMO = [
  ["03000000001", "Customer · Sara"],
  ["03000000002", "Worker · Imran"],
  ["03000000003", "Admin"],
];

function Login() {
  const router = useRouter();
  const sp = useSearchParams();
  const [role, setRole] = useState<"CUSTOMER" | "WORKER">(sp.get("role") === "WORKER" ? "WORKER" : "CUSTOMER");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [demoCode, setDemoCode] = useState<string>();
  const [smsSent, setSmsSent] = useState(false);
  const [smsFailed, setSmsFailed] = useState(false);
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const { t } = useLang();

  const request = async (p = phone) => {
    setLoading(true);
    setErr(undefined);
    try {
      const r = await post("/auth/otp/request", { phone: p });
      setDemoCode(r.demoCode);
      setSmsSent(!!r.sms);
      setSmsFailed(!!r.smsFailed);
      if (r.demoCode) setCode(r.demoCode);
      setStep("code");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    setErr(undefined);
    try {
      const me = await post("/auth/otp/verify", { phone, code, role });
      const next = sp.get("next");
      const home = me.role === "ADMIN" ? "/admin" : me.role === "WORKER" ? "/w" : "/";
      router.push(next && next.startsWith(me.role === "WORKER" ? "/w" : me.role === "ADMIN" ? "/admin" : "/c") ? next : home);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hero-grad hidden flex-col justify-between p-12 text-white md:flex">
        <Link href="/"><Logo dark /></Link>
        <div>
          <h1 className="text-[44px] font-extrabold leading-tight">Trusted help, one phone number away.</h1>
          <p className="urdu mt-4 text-2xl text-amber">ہنر مند کو کام، گھر کو آرام</p>
        </div>
        <TruckStrip />
      </div>
      <div className="flex items-center justify-center p-5">
        <PageFade className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between"><span className="md:invisible"><Logo /></span><LangToggle /></div>
          <Card className="p-7">
            <h2 className="text-2xl font-extrabold">{step === "phone" ? <T en="Log in or sign up" ur="لاگ ان یا سائن اپ" /> : <T en="Enter the 4-digit code" ur="4 ہندسوں کا کوڈ درج کریں" />}</h2>
            <p className="mt-1 text-sm text-ink-2">{step === "phone" ? <T en="We'll text you a code. No passwords." ur="ہم آپ کو کوڈ بھیجیں گے۔ کوئی پاس ورڈ نہیں۔" /> : smsSent ? <T en={`Code sent by SMS to ${phone}`} ur={`کوڈ ${phone} پر SMS کر دیا گیا`} /> : `${t("Sent to", "بھیجا گیا")} ${phone}`}</p>

            {step === "phone" && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {([
                    ["CUSTOMER", "I need help", "مدد چاہیے", Home],
                    ["WORKER", "I'm a worker", "میں کاریگر ہوں", Briefcase],
                  ] as const).map(([r, en, u, I]) => (
                    <button key={r} onClick={() => setRole(r)} className={cx("flex min-h-[88px] flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left", role === r ? "border-brand bg-brand-50" : "border-line")}>
                      <I className="h-5 w-5" />
                      <span className="font-bold">{en}</span>
                      <span className="urdu text-sm text-ink-2">{u}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-5 flex items-center gap-2 rounded-2xl border border-line px-4">
                  <Phone className="h-5 w-5 text-ink-3" />
                  <span className="font-semibold text-ink-2">+92</span>
                  <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 1234567" className="h-14 flex-1 bg-transparent text-lg outline-none" />
                </label>
                <ErrorNote error={err} />
                <Button size={role === "WORKER" ? "XL" : "L"} className="mt-4 w-full" loading={loading} onClick={() => request()}>
                  <T en="Send code" ur="کوڈ بھیجیں" />
                </Button>
                <div className="mt-6 rounded-2xl bg-amber-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold"><DemoTag /> Judge accounts (OTP 1234)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DEMO.map(([p, label]) => (
                      <button key={p} onClick={() => { setPhone(p); request(p); }} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === "code" && (
              <>
                {demoCode && (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm">
                    <DemoTag /> {smsFailed ? t("SMS failed — demo code:", "SMS نہیں گیا — ڈیمو کوڈ:") : "Demo OTP:"} <b className="tracking-widest">{demoCode}</b> <span className="text-ink-2">{t("(auto-filled)", "(خود بھر دیا)")}</span>
                  </div>
                )}
                <div className="mt-5 flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      inputMode="numeric"
                      maxLength={1}
                      value={code[i] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        const next = (code.slice(0, i) + v + code.slice(i + 1)).slice(0, 4);
                        setCode(next);
                        if (v) (e.target.nextElementSibling as HTMLInputElement | null)?.focus();
                      }}
                      className="h-16 w-14 rounded-2xl border-2 border-line text-center text-2xl font-extrabold focus:border-brand focus:outline-none"
                    />
                  ))}
                </div>
                <ErrorNote error={err} />
                <Button size={role === "WORKER" ? "XL" : "L"} className="mt-5 w-full" loading={loading} disabled={code.length !== 4} onClick={verify}>
                  <T en="Verify & continue" ur="تصدیق کریں" />
                </Button>
                <button onClick={() => setStep("phone")} className="mt-3 w-full text-sm text-ink-2"><T en="Change number" ur="نمبر تبدیل کریں" /></button>
              </>
            )}
            <p className="mt-6 flex items-center gap-2 text-xs text-ink-3">
              <ShieldCheck className="h-4 w-4" /> {t("Real SMS via SimGate. Judge demo numbers skip SMS so the demo can't fail.", "اصلی SMS کے ذریعے کوڈ۔ ڈیمو نمبرز پر SMS نہیں جاتا۔")}
            </p>
          </Card>
        </PageFade>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
