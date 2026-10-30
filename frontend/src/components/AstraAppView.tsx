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
import { accountApi as api, type Account as Me, type Setup, type SetupPatch } from "@/lib/account";
import Onboarding, { SetupFrame } from "@/components/onboarding/Onboarding";
import setupStyles from "@/components/onboarding/onboarding.module.css";
import homeStyles from "@/app/home.module.css";

function Logo({ onBack }: { onBack?: () => void }) {
  return (
    <a
      href="/"
      onClick={(e) => {
        if (onBack) {
          e.preventDefault();
          onBack();
        }
      }}
      style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 600, fontSize: "18px", color: "#18241d" }}
    >
      <span className={homeStyles.mark} aria-hidden="true">
        <svg viewBox="0 0 40 44" fill="none">
          <path
            d="M20 5 7 38M20 5l13 33M11.5 27h17"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M20 14l4.5 9h-9L20 14Z" fill="currentColor" opacity="0.28" />
        </svg>
      </span>
      <span>Astra AI</span>
    </a>
  );
}

export function Login({ onBack }: { onBack?: () => void } = {}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  useEffect(() => () => { verifier.current?.clear(); verifier.current = null; }, []);

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

  return <SetupFrame index={step === "phone" ? 0 : 1}>
    <section className={setupStyles.content}>
      <h1 className={setupStyles.heading}>{step === "phone" ? <>Your Astra starts<br />with a hello.</> : <>One little code.<br />Then you’re in.</>}</h1>
      <p className={setupStyles.description}>{step === "phone"
        ? "Sign in with your WhatsApp number. We’ll text you a code to make sure it’s you."
        : `Enter the six-digit code we sent to ${e164}.`}</p>
      {step === "phone" ? <form onSubmit={sendOtp} className={setupStyles.form}>
        <label className={setupStyles.label} htmlFor="login-phone">Phone number</label>
        <div className={setupStyles.phoneInput}>
          <span aria-label="India country code">+91</span>
          <input id="login-phone" className={setupStyles.input} type="tel" inputMode="tel" autoComplete="tel-national" autoFocus value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="98765 43210" maxLength={14} disabled={busy} />
        </div>
        <button disabled={busy} className={setupStyles.primary}>{busy ? "Sending code…" : "Continue"}</button>
      </form> : <form onSubmit={verifyOtp} className={setupStyles.form}>
        <label className={setupStyles.label} htmlFor="login-code">Verification code</label>
        <input id="login-code" className={`${setupStyles.input} ${setupStyles.otp}`} type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} disabled={busy} />
        <button disabled={busy || code.length !== 6} className={setupStyles.primary}>{busy ? "Verifying…" : "Continue"}</button>
        <div className={setupStyles.footer}><button type="button" disabled={busy} onClick={() => { setStep("phone"); setCode(""); setError(null); }} className={setupStyles.textButton}>← Change number</button></div>
      </form>}
      {error && <p className={setupStyles.error} role="alert">{error}</p>}
      <div id="recaptcha-container" />
      {onBack && step === "phone" && (
        <div className={setupStyles.footer}>
          <button type="button" onClick={onBack} className={setupStyles.textButton}>
            ← Back to Astra home
          </button>
        </div>
      )}
      <p className={setupStyles.smallNote}>By continuing, you agree to receive a verification SMS. Standard message rates may apply.</p>
    </section>
  </SetupFrame>;
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

function Dashboard({ user, onSetup }: { user: User; onSetup: () => Promise<void> }) {
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
    <div className={homeStyles.site}>
      <header style={{ borderBottom: "1px solid #d8e4dc", background: "rgba(255, 253, 250, 0.92)", backdropFilter: "blur(18px)" }} className="sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs" style={{ color: "#5e6d63" }}>{user.phoneNumber}</span>
            <button onClick={() => { void onSetup().catch((cause) => setToast(cause instanceof Error ? cause.message : "Couldn’t reopen setup")); }} className="text-xs px-3 py-2 rounded-lg" style={{ border: "1px solid #cce0d4", background: "#fff", color: "#18241d" }}>Personalize</button>
            <button onClick={() => signOut(auth)} className="text-xs px-3 py-2 rounded-lg" style={{ border: "1px solid #cce0d4", background: "#fff", color: "#18241d" }}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#1b7a4e" }}>Your Astra</p>
            <h1 className="text-3xl md:text-4xl mt-1" style={{ color: "#18241d" }}>Hey{me?.name ? ` ${me.name}` : ""} 👋</h1>
            <p className="text-sm mt-1" style={{ color: "#5e6d63" }}>Everything Astra can do for you on WhatsApp, in one place.</p>
          </div>
          <a href={waLink} target="_blank" rel="noreferrer" className={`${homeStyles.button} ${homeStyles.darkButton}`}>
            💬 Chat with Astra on WhatsApp
          </a>
        </div>

        {toast && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#eaf6ee", border: "1px solid #98c7ab", color: "#175234" }}>{toast}</div>}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#fdf2f2", border: "1px solid #e0b4b4", color: "#8c2d2d" }}>
            Couldn't load your account: {error} <button onClick={load} className="underline ml-2">Retry</button>
          </div>
        )}

        <section className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5" style={{ border: "1px solid #cce0d4", background: "linear-gradient(150deg, #fffefa, #f5faf7)" }}>
            <p className="text-xs" style={{ color: "#5e6d63" }}>Plan</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "#18241d" }}>{me ? me.plan.name : "—"}</p>
            {me && !me.plan.is_premium && (
              <button onClick={upgrade} className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "#1b7a4e", color: "#fff" }}>
                Upgrade · ₹{me.plan.price_inr}/mo
              </button>
            )}
            {me?.plan.expires_at && <p className="text-xs mt-2" style={{ color: "#5e6d63" }}>Renews {new Date(me.plan.expires_at).toLocaleDateString("en-IN")}</p>}
          </div>
          <div className="rounded-2xl p-5" style={{ border: "1px solid #cce0d4", background: "linear-gradient(150deg, #fffefa, #f5faf7)" }}>
            <p className="text-xs" style={{ color: "#5e6d63" }}>Messages today</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "#18241d" }}>{me ? `${me.usage.used_today} / ${me.usage.daily_limit}` : "—"}</p>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "#dfeee5" }}>
              <div className="h-full" style={{ width: `${pct}%`, background: "#1b7a4e" }} />
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ border: "1px solid #cce0d4", background: "linear-gradient(150deg, #fffefa, #f5faf7)" }}>
            <p className="text-xs" style={{ color: "#5e6d63" }}>Connected apps</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "#18241d" }}>{me ? `${connectedCount} / ${me.connections.length}` : "—"}</p>
            <p className="text-xs mt-2" style={{ color: "#5e6d63" }}>Linked to {user.phoneNumber}</p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl" style={{ color: "#18241d" }}>Your apps</h2>
            <button onClick={load} className="text-xs" style={{ color: "#1b7a4e", fontWeight: 600 }}>↻ Refresh</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {(me?.connections ?? []).map((c) => {
              const on = c.status === "active";
              return (
                <div key={c.slug} className="rounded-2xl p-5 flex flex-col justify-between" style={{ border: on ? "1px solid #8fc4a4" : "1px solid #cce0d4", background: on ? "linear-gradient(140deg, #f2fbf5, #e3f3e9)" : "linear-gradient(150deg, #fffefa, #f5faf7)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{c.icon}</span>
                      <div>
                        <h3 className="font-bold" style={{ color: "#18241d" }}>{c.name}</h3>
                        <span className="text-[11px]" style={{ color: "#5e6d63" }}>{c.category}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: on ? "#dcf2e4" : "#eef4f0", color: on ? "#195936" : "#5e6d63", border: on ? "1px solid #a3d4b5" : "1px solid #d5e3da" }}>
                      {on ? "✓ Connected" : c.status === "pending" ? "Pending" : c.status === "unknown" ? "Status unavailable" : "Not linked"}
                    </span>
                  </div>
                  <p className="text-xs mt-3 leading-relaxed" style={{ color: "#4f6256" }}>{c.description}</p>
                  <button
                    onClick={() => connect(c.slug)}
                    disabled={busySlug === c.slug || !c.configured}
                    className={`mt-4 ${homeStyles.button} ${on ? homeStyles.lightButton : homeStyles.darkButton}`}
                    style={{ width: "100%", height: "42px", fontSize: "13px" }}
                  >
                    {busySlug === c.slug ? "Please wait..." : !c.configured ? "Coming soon" : on ? "Reconnect" : `Connect ${c.name} →`}
                  </button>
                  {on && <button onClick={() => disconnect(c.slug)} disabled={busySlug === c.slug} className="mt-2 text-xs" style={{ color: "#5e6d63" }}>Disconnect</button>}
                </div>
              );
            })}
          </div>
        </section>

        <ContactChannels subtitle="Text Astra from any of these — same assistant, same connected apps." />
      </main>
    </div>
  );
}

export function AccountEntry({ user }: { user: User }) {
  const [account, setAccount] = useState<Me | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [profile, preferences] = await Promise.all([
        api<Me>(user, "/api/me"), api<Setup>(user, "/api/me/onboarding"),
      ]);
      setAccount(profile); setSetup(preferences);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t load your account"); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  async function save(patch: SetupPatch) {
    const saved = await api<Setup>(user, "/api/me/onboarding", { method: "PATCH", body: JSON.stringify(patch) });
    setSetup(saved);
    return saved;
  }
  async function reopen() {
    const preferences = await api<Setup>(user, "/api/me/onboarding", { method: "PATCH", body: JSON.stringify({ step: "name" }) });
    const profile = await api<Me>(user, "/api/me");
    setAccount(profile); setSetup(preferences);
  }

  if (setup?.completed) return <Dashboard user={user} onSetup={reopen} />;
  if (!account || !setup) return <SetupFrame index={2}>
    <h1 className={setupStyles.heading}>{error ? "Let’s try that again." : "Making room for you…"}</h1>
    <p className={setupStyles.description}>{error || "Getting your account and saved preferences ready."}</p>
    {error && <><button className={setupStyles.primary} onClick={() => void load()}>Try again</button><div className={setupStyles.footer}><button className={setupStyles.textButton} onClick={() => void signOut(auth)}>Sign out</button></div></>}
  </SetupFrame>;
  return <Onboarding account={account} setup={setup} save={save} onComplete={setSetup}
    connect={async (slug) => {
      const result = await api<{ auth_url: string }>(user, "/api/me/connectors/link", { method: "POST", body: JSON.stringify({ toolkit: slug }) });
      if (!result.auth_url) throw new Error("No connection link was returned. Please try again.");
      window.location.assign(result.auth_url);
    }}
    checkout={async (plan) => {
      const result = await api<{ payment_url: string }>(user, "/api/me/upgrade", { method: "POST", body: JSON.stringify({ plan }) });
      if (!result.payment_url) throw new Error("No checkout link was returned. You can continue for free.");
      await save({ step: "complete" });
      window.location.assign(result.payment_url);
    }} />;
}

export default function AstraApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <SetupFrame index={0}><h1 className={setupStyles.heading}>A little less to do.<br />A little more you.</h1><p className={setupStyles.description}>Opening Astra…</p></SetupFrame>;
  return user ? <AccountEntry key={user.uid} user={user} /> : <Login />;
}
