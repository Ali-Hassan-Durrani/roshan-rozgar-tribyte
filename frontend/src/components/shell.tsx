"use client";

import { Bell, Briefcase, CalendarCheck, Home, LayoutGrid, LogOut, MessageSquare, Search, Shield, Star, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { post, useApi } from "@/lib/api";
import { LangToggle, useDefaultLang, useLang } from "@/lib/i18n";
import { Avatar, cx, Logo, TruckStrip } from "./ui";

export type Me = {
  id: string;
  phone: string;
  role: "CUSTOMER" | "WORKER" | "ADMIN";
  name: string | null;
  lang: "UR" | "EN";
  demoMode: boolean;
  worker: { id: string; status: string; availability: string; activeBookingId: string | null } | null;
  customer: { address: string | null; area: string | null } | null;
};

export const useMe = () => useApi<Me>("/auth/me");

export async function logout(router: ReturnType<typeof useRouter>) {
  await post("/auth/logout").catch(() => {});
  router.push("/");
  router.refresh();
}

export function CustomerNav() {
  const { data: me } = useMe();
  const path = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const links = [
    ["/", t("Home", "گھر")],
    ["/c/workers", t("Find workers", "کاریگر تلاش کریں")],
    ["/c/bookings", t("My bookings", "میری بکنگز")],
  ];
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-4 md:px-16">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="hidden gap-9 md:flex">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className={cx("text-[15px]", path === href ? "font-bold text-ink" : "text-ink-2 hover:text-ink")}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LangToggle />

            <span className="hidden h-10 w-10 place-items-center rounded-full bg-amber-50 md:grid">
              <Bell className="h-5 w-5 text-ink-2" />
            </span>
            {me ? (
              <button onClick={() => logout(router)} className="flex items-center gap-2" title="Log out">
                <Avatar name={me.name} size={40} />
                <span className="hidden text-[15px] font-semibold md:inline">{me.name ?? "Me"}</span>
                <LogOut className="h-4 w-4 text-ink-3" />
              </button>
            ) : (
              <Link href="/login" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">
                {t("Log in", "لاگ ان")}
              </Link>
            )}
          </div>
        </div>
      </header>
      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-white py-2 md:hidden">
        {[
          ["/", t("Home", "گھر"), Home],
          ["/c/workers", t("Search", "تلاش"), Search],
          ["/c/bookings", t("Bookings", "بکنگز"), CalendarCheck],
        ].map(([href, label, I]: any) => (
          <Link key={href} href={href} className={cx("flex flex-col items-center gap-1 text-xs", path === href ? "font-bold text-brand" : "text-ink-3")}>
            <I className="h-5 w-5" /> {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function CustomerPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <CustomerNav />
      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-16">{children}</main>
    </div>
  );
}

export function WorkerShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { t, ur } = useLang();
  useDefaultLang("ur");
  const items: [string, string, any][] = [
    ["/w", t("Home", "گھر"), Home],
    ["/w/jobs", t("Jobs", "کام"), Briefcase],
    ["/w/onboarding", t("Profile", "پروفائل"), User],
  ];
  return (
    <div dir={ur ? "rtl" : "ltr"} className="min-h-screen pb-24 md:flex md:pb-0">
      <aside className="hidden w-64 shrink-0 flex-col bg-brand text-white md:flex">
        <TruckStrip />
        <div className="p-6" dir="ltr">
          <Logo dark />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {items.map(([href, label, I]) => (
            <Link key={href} href={href} className={cx(ur && "urdu", "flex min-h-16 items-center gap-3 rounded-2xl px-4 text-lg", path === href ? "bg-white/10 font-bold text-amber" : "text-brand-100")}>
              <I className="h-6 w-6" /> {label}
            </Link>
          ))}
          <button onClick={() => logout(router)} className={cx(ur && "urdu", "flex min-h-16 items-center gap-3 rounded-2xl px-4 text-lg text-brand-100")}>
            <LogOut className="h-6 w-6" /> {t("Log out", "لاگ آؤٹ")}
          </button>
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-[900px] px-5 py-6 md:px-10">
        <div className="mb-4 flex justify-end">
          <LangToggle />
        </div>
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-white py-2 md:hidden">
        {items.map(([href, label, I]) => (
          <Link key={href} href={href} className={cx(ur && "urdu", "flex min-h-16 min-w-16 flex-col items-center justify-center text-sm", path === href ? "font-bold text-brand" : "text-ink-3")}>
            <I className="h-6 w-6" /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AdminShell({ tab, setTab, children }: { tab: string; setTab: (t: string) => void; children: ReactNode }) {
  const router = useRouter();
  const tabs: [string, string, any][] = [
    ["overview", "Overview", LayoutGrid],
    ["workers", "Workers", Users],
    ["bookings", "Bookings", CalendarCheck],
    ["reviews", "Reviews & AI flags", Star],
  ];
  return (
    <div className="min-h-screen md:flex">
      <aside className="flex shrink-0 flex-col bg-ink text-white md:min-h-screen md:w-64">
        <TruckStrip />
        <div className="flex items-center justify-between p-5">
          <Logo dark />
          <Shield className="h-5 w-5 text-amber md:hidden" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {tabs.map(([k, label, I]) => (
            <button key={k} onClick={() => setTab(k)} className={cx("flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm", tab === k ? "bg-white/10 font-bold text-amber" : "text-white/70")}>
              <I className="h-5 w-5" /> {label}
            </button>
          ))}
          <button onClick={() => logout(router)} className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/70">
            <LogOut className="h-5 w-5" /> Log out
          </button>
        </nav>
      </aside>
      <main className="w-full px-4 py-8 md:px-10">{children}</main>
    </div>
  );
}

export const Messages = MessageSquare;
