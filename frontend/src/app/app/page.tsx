"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  User,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import ContactChannels from "@/components/ContactChannels";
import { CHANNELS, GREETING } from "@/lib/channels";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const LANDING_URL = "https://yell.nhancio.com";

interface Connection {
  slug: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  status: string;
  configured: boolean;
}

interface Me {
  phone_number: string;
  name: string | null;
  member_since: string | null;
  plan: { is_premium: boolean; name: string; expires_at: string | null; price_inr: number };
  usage: { used_today: number; daily_limit: number };
  whatsapp_number: string;
  connections: Connection[];
}

async function api<T>(user: User, path: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

function Logo() {
  return (
    <a href={LANDING_URL} className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-[#25D366] text-black font-black flex items-center justify-center">Y</div>
      <span className="font-bold text-lg text-white">Yell AI</span>
    </a>
  );
}

function Login() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  const digits = phone.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+91${digits}` : digits.startsWith("91") && digits.length === 12 ? `+${digits}` : "";

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!e164) return setError("Enter a valid 10-digit Indian mobile number");
    setBusy(true);
    try {
      if (!verifier.current) {
        verifier.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      confirmation.current = await signInWithPhoneNumber(auth, e164, verifier.current);
      setStep("otp");
    } catch (err: any) {
      verifier.current?.clear();
      verifier.current = null;
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmation.current) return;
    setError(null);
    setBusy(true);
    try {
      await confirmation.current.confirm(code.trim());
    } catch (err: any) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <header className="max-w-5xl w-full mx-auto px-4 py-5"><Logo /></header>
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            {step === "phone" ? "Link your WhatsApp number" : "Enter the OTP"}
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            {step === "phone"
              ? "Use the same number you chat with Yell AI on WhatsApp. We'll text you a 6-digit code."
              : `We sent a 6-digit code to ${e164}.`}
          </p>

          {step === "phone" ? (
            <form onSubmit={sendOtp} className="mt-6 space-y-4">
              <div className="flex items-center bg-black/60 border border-white/15 rounded-xl px-4 py-3 focus-within:border-emerald-400/60">
                <span className="text-slate-400 font-semibold text-sm mr-2 whitespace-nowrap shrink-0">🇮🇳 +91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  maxLength={14}
                  className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full font-medium tracking-wide"
                />
              </div>
              <button disabled={busy} className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-bold transition">
                {busy ? "Sending OTP..." : "Send OTP →"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="mt-6 space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-emerald-400/60"
              />
              <button disabled={busy || code.length !== 6} className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-bold transition">
                {busy ? "Verifying..." : "Verify & open Yell →"}
              </button>
              <button type="button" onClick={() => { setStep("phone"); setCode(""); }} className="w-full text-xs text-slate-400 hover:text-white">
                ← Change number
              </button>
            </form>
          )}

          {error && <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">{error}</div>}
          <div id="recaptcha-container" />
          <p className="text-[11px] text-slate-500 mt-6">By continuing you agree to receive an SMS for verification. Standard rates may apply.</p>
        </div>
      </main>
    </div>
  );
}

function friendly(err: any): string {
  const code = err?.code || "";
  if (code.includes("invalid-verification-code")) return "Wrong OTP — please check and try again.";
  if (code.includes("code-expired")) return "OTP expired — go back and request a new one.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait a few minutes.";
  if (code.includes("invalid-phone-number")) return "That phone number doesn't look right.";
  if (code.includes("quota-exceeded")) return "SMS quota reached for today. Try again later.";
  return err?.message || "Something went wrong. Please try again.";
}

function Dashboard({ user }: { user: User }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMe(await api<Me>(user, "/api/me"));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (connected) {
      setToast(`Checking ${connected} authorization status...`);
      window.history.replaceState({}, "", window.location.pathname);
    }
    load();
  }, [load]);

  async function connect(slug: string) {
    setBusySlug(slug);
    try {
      const res = await api<{ auth_url: string }>(user, "/api/me/connectors/link", {
        method: "POST",
        body: JSON.stringify({ toolkit: slug }),
      });
      if (res.auth_url) window.location.href = res.auth_url;
    } catch (e: any) {
      setToast(`⚠️ ${e.message}`);
      setBusySlug(null);
    }
  }

  async function disconnect(slug: string) {
    setBusySlug(slug);
    try {
      await api(user, `/api/me/connectors/${encodeURIComponent(slug)}`, { method: "DELETE" });
      await load();
      setToast("App disconnected.");
    } catch (e: any) {
      setToast(`⚠️ ${e.message}`);
    } finally {
      setBusySlug(null);
    }
  }

  async function upgrade() {
    try {
      const res = await api<{ payment_url: string }>(user, "/api/me/upgrade", { method: "POST" });
      window.location.href = res.payment_url;
    } catch (e: any) {
      setToast(`⚠️ ${e.message}`);
    }
  }

  const waLink = `https://wa.me/${CHANNELS.whatsapp}?text=${encodeURIComponent(GREETING)}`;
  const connectedCount = me?.connections.filter((c) => c.status === "active").length ?? 0;
  const pct = me ? Math.min(100, Math.round((me.usage.used_today / Math.max(1, me.usage.daily_limit)) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <header className="border-b border-white/10 bg-[#070b14]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-slate-400">{user.phoneNumber}</span>
            <button onClick={() => signOut(auth)} className="text-xs px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Your Yell</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-1">Hey{me?.name ? ` ${me.name}` : ""} 👋</h1>
            <p className="text-slate-400 text-sm mt-1">Everything Yell can do for you on WhatsApp, in one place.</p>
          </div>
          <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex justify-center bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-5 py-3 rounded-xl transition">
            💬 Chat with Yell on WhatsApp
          </a>
        </div>

        {toast && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-300">{toast}</div>}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
            Couldn't load your account: {error} <button onClick={load} className="underline ml-2">Retry</button>
          </div>
        )}

        <section className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-xs text-slate-400">Plan</p>
            <p className="text-2xl font-bold text-white mt-1">{me ? me.plan.name : "—"}</p>
            {me && !me.plan.is_premium && (
              <button onClick={upgrade} className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-400 text-black hover:bg-amber-300">
                Upgrade · ₹{me.plan.price_inr}/mo
              </button>
            )}
            {me?.plan.expires_at && <p className="text-xs text-slate-500 mt-2">Renews {new Date(me.plan.expires_at).toLocaleDateString("en-IN")}</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-xs text-slate-400">Messages today</p>
            <p className="text-2xl font-bold text-white mt-1">{me ? `${me.usage.used_today} / ${me.usage.daily_limit}` : "—"}</p>
            <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[#25D366]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-xs text-slate-400">Connected apps</p>
            <p className="text-2xl font-bold text-white mt-1">{me ? `${connectedCount} / ${me.connections.length}` : "—"}</p>
            <p className="text-xs text-slate-500 mt-2">Linked to {user.phoneNumber}</p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Your apps</h2>
            <button onClick={load} className="text-xs text-slate-400 hover:text-white">↻ Refresh</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {(me?.connections ?? []).map((c) => {
              const on = c.status === "active";
              return (
                <div key={c.slug} className={`rounded-2xl border p-5 flex flex-col justify-between ${on ? "border-emerald-500/50 bg-emerald-950/20" : "border-white/10 bg-slate-900/60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{c.icon}</span>
                      <div>
                        <h3 className="font-bold text-white">{c.name}</h3>
                        <span className="text-[11px] text-slate-400">{c.category}</span>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${on ? "bg-emerald-500/20 text-emerald-300" : c.status === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-white/5 text-slate-400"}`}>
                      {on ? "✓ Connected" : c.status === "pending" ? "Pending" : c.status === "unknown" ? "Status unavailable" : "Not linked"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-3 leading-relaxed">{c.description}</p>
                  <button
                    onClick={() => connect(c.slug)}
                    disabled={busySlug === c.slug || !c.configured}
                    className={`mt-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${on ? "bg-white/10 hover:bg-white/15 text-white" : "bg-[#25D366] hover:bg-[#1ebe5d] text-black"}`}
                  >
                    {busySlug === c.slug ? "Please wait..." : !c.configured ? "Coming soon" : on ? "Reconnect" : `Connect ${c.name} →`}
                  </button>
                  {on && <button onClick={() => disconnect(c.slug)} disabled={busySlug === c.slug} className="mt-2 text-xs text-slate-400 hover:text-white disabled:opacity-50">Disconnect</button>}
                </div>
              );
            })}
            {!me && !error && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-slate-900/60 animate-pulse" />)}
          </div>
        </section>

        <ContactChannels subtitle="Text Yell from any of these — same assistant, same connected apps." />
      </main>
    </div>
  );
}

export default function YellApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) {
    return <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400">Loading Yell…</div>;
  }
  return user ? <Dashboard user={user} /> : <Login />;
}
