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
import { GREETING } from "@/lib/channels";
import {
  accountApi as api,
  clearWhatsAppSession,
  loadWhatsAppSession,
  publicApi,
  saveWhatsAppSession,
  subscribeWhatsAppSession,
  type Account as Me,
  type SessionUser,
  type Setup,
  type SetupPatch,
} from "@/lib/account";
import Onboarding, { SetupFrame } from "@/components/onboarding/Onboarding";
import setupStyles from "@/components/onboarding/onboarding.module.css";
import homeStyles from "@/app/home.module.css";

interface WhatsAppChallenge {
  code: string;
  poll_token: string;
  whatsapp_url: string;
  expires_in: number;
}

function logoutSession() {
  clearWhatsAppSession();
  void signOut(auth);
}

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
  const [mode, setMode] = useState<"whatsapp" | "sms">("whatsapp");
  const [challenge, setChallenge] = useState<WhatsAppChallenge | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waOpened, setWaOpened] = useState(false);
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return "";
    const raw = (new URLSearchParams(window.location.search).get("phone") || "").replace(/\D/g, "");
    return raw.length === 12 && raw.startsWith("91") ? raw.slice(2) : raw.slice(-10);
  });
  const [paidInfo] = useState<{ plan: string; name: string; phone: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    if (p.get("paid") !== "1") return null;
    return {
      plan: p.get("plan") === "business" ? "Business" : "Pro",
      name: p.get("name") || "",
      phone: p.get("phone") || "",
    };
  });
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  useEffect(() => () => { verifier.current?.clear(); verifier.current = null; }, []);

  const startWaChallenge = useCallback(async () => {
    setWaLoading(true);
    setError(null);
    try {
      const next = await publicApi<WhatsAppChallenge>("/api/me/whatsapp-login/start", { method: "POST" });
      setChallenge(next);
      return next;
    } catch (err: any) {
      setError(err?.message || "Couldn’t start WhatsApp sign-in. You can use an SMS code below.");
      return null;
    } finally {
      setWaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "whatsapp" && !challenge && !waLoading) {
      void startWaChallenge();
    }
  }, [mode, challenge, waLoading, startWaChallenge]);

  useEffect(() => {
    if (mode !== "whatsapp" || !challenge) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await publicApi<{ status: string; token?: string; phone_number?: string }>(
          "/api/me/whatsapp-login/poll",
          {
            method: "POST",
            body: JSON.stringify({ code: challenge.code, poll_token: challenge.poll_token }),
          }
        );
        if (!cancelled && res.status === "verified" && res.token && res.phone_number) {
          saveWhatsAppSession(res.token, res.phone_number);
        }
      } catch (err: any) {
        if (!cancelled && String(err?.message || "").includes("expired")) {
          setChallenge(null);
          setWaOpened(false);
        }
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mode, challenge]);

  const digits = phone.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+91${digits}` : digits.startsWith("91") && digits.length === 12 ? `+${digits}` : "";

  async function openWhatsApp() {
    setError(null);
    const active = challenge || (await startWaChallenge());
    if (!active?.whatsapp_url) return;
    setWaOpened(true);
    window.open(active.whatsapp_url, "_blank", "noopener,noreferrer");
  }

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

  if (mode === "whatsapp") {
    return <SetupFrame index={waOpened ? 1 : 0} showProgress={false}>
      <section className={setupStyles.content}>
        {paidInfo && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "#eaf6ee", border: "1px solid #98c7ab", color: "#175234" }}>
            🎉 Payment received for <strong>Astra {paidInfo.plan}</strong>{paidInfo.name ? ` (${paidInfo.name})` : ""}! Sign in below to access your account.
          </div>
        )}
        <h1 className={setupStyles.heading}>{waOpened ? <>Send the message<br />on WhatsApp.</> : <>Your Astra starts<br />with a hello.</>}</h1>
        <div className={setupStyles.form}>
          {challenge?.whatsapp_url ? (
            <a
              href={challenge.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setWaOpened(true)}
              className={setupStyles.primary}
            >
              {waOpened ? "Open WhatsApp again →" : "Continue with WhatsApp"}
            </a>
          ) : (
            <button type="button" disabled={waLoading} onClick={() => void openWhatsApp()} className={setupStyles.primary}>
              {waLoading ? "Preparing WhatsApp link…" : "Continue with WhatsApp"}
            </button>
          )}
          {waOpened && challenge && (
            <p className={setupStyles.smallNote} aria-live="polite">
              Waiting for confirmation from WhatsApp (code <strong>{challenge.code}</strong>)…
            </p>
          )}
          <div className={setupStyles.footer}>
            <button
              type="button"
              onClick={() => { setMode("sms"); setError(null); }}
              className={setupStyles.textButton}
            >
              Use phone SMS OTP instead (backup)
            </button>
          </div>
        </div>
        {error && <p className={setupStyles.error} role="alert">{error}</p>}
        <div id="recaptcha-container" />
        {onBack && (
          <div className={setupStyles.footer}>
            <button type="button" onClick={onBack} className={setupStyles.textButton}>
              ← Back to Astra home
            </button>
          </div>
        )}
      </section>
    </SetupFrame>;
  }

  return <SetupFrame index={step === "phone" ? 0 : 1} showProgress={false}>
    <section className={setupStyles.content}>
      {paidInfo && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "#eaf6ee", border: "1px solid #98c7ab", color: "#175234" }}>
          🎉 Payment received for <strong>Astra {paidInfo.plan}</strong>{paidInfo.name ? ` (${paidInfo.name})` : ""}! Sign in below to access your account.
        </div>
      )}
      <h1 className={setupStyles.heading}>{step === "phone" ? <>Sign in with<br />SMS code.</> : <>One little code.<br />Then you’re in.</>}</h1>
      <p className={setupStyles.description}>{step === "phone"
        ? "Enter your WhatsApp phone number and we’ll text you a 6-digit verification code."
        : `Enter the six-digit code we sent to ${e164}.`}</p>
      {step === "phone" ? <form onSubmit={sendOtp} className={setupStyles.form}>
        <label className={setupStyles.label} htmlFor="login-phone">Phone number</label>
        <div className={setupStyles.phoneInput}>
          <span aria-label="India country code">+91</span>
          <input id="login-phone" className={setupStyles.input} type="tel" inputMode="tel" autoComplete="tel-national" autoFocus value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="98765 43210" maxLength={14} disabled={busy} />
        </div>
        <button disabled={busy} className={setupStyles.primary}>{busy ? "Sending code…" : "Send SMS code"}</button>
        <div className={setupStyles.footer}>
          <button type="button" disabled={busy} onClick={() => { setMode("whatsapp"); setError(null); }} className={setupStyles.textButton}>
            ← Back to WhatsApp login (recommended)
          </button>
        </div>
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

interface UpgradeResponse {
  payment_url: string;
  checkout?: {
    key_id: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    plan_tier?: string;
    notes?: Record<string, string>;
    prefill?: Record<string, string>;
    readonly?: Record<string, boolean>;
    hidden?: Record<string, boolean>;
    config?: Record<string, unknown>;
  };
}

function loadRazorpaySdk(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as any;
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(w.Razorpay);
    script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.head.appendChild(script);
  });
}

async function launchRazorpayCheckout(res: UpgradeResponse, onDismiss?: () => void): Promise<void> {
  const cfg = res.checkout;
  if (cfg?.key_id && cfg?.order_id) {
    try {
      const RazorpayCtor = await loadRazorpaySdk();
      if (RazorpayCtor) {
        const phoneParam = cfg.notes?.phone_number || "";
        const rzp = new RazorpayCtor({
          key: cfg.key_id,
          order_id: cfg.order_id,
          amount: cfg.amount,
          currency: cfg.currency,
          name: cfg.name,
          description: cfg.description,
          notes: cfg.notes,
          prefill: cfg.prefill,
          readonly: cfg.readonly,
          hidden: cfg.hidden,
          config: cfg.config,
          theme: { color: "#1b7a4e" },
          handler: (response: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
            const q = new URLSearchParams({
              razorpay_payment_id: response.razorpay_payment_id || "",
              razorpay_order_id: response.razorpay_order_id || cfg.order_id,
              razorpay_signature: response.razorpay_signature || "",
              plan: cfg.plan_tier || "pro",
              phone: phoneParam,
            });
            window.location.assign(`/payment/success?${q.toString()}`);
          },
          modal: {
            ondismiss: () => {
              onDismiss?.();
            },
          },
        });
        rzp.open();
        return;
      }
    } catch {
      // Fallback to hosted checkout URL below
    }
  }
  if (res.payment_url) {
    window.location.assign(res.payment_url);
  }
}

function Dashboard({ user, initialMe, onSetup, prompt, requestedPlan }: { user: SessionUser; initialMe?: Me | null; onSetup: () => Promise<void>; prompt: string; requestedPlan?: "pro" | "business" }) {
  const [me, setMe] = useState<Me | null>(initialMe ?? null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  useEffect(() => {
    if (initialMe) setMe(initialMe);
  }, [initialMe]);

  const load = useCallback(async () => {
    try {
      const profile = await api<Me>(user, "/api/me");
      setMe(profile);
      setError(null);
      return profile;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (connected) {
      window.history.replaceState({}, "", window.location.pathname);
      const existing = initialMe?.connections.find((c) => c.slug === connected);
      if (existing?.status === "active") {
        setToast(`✓ ${existing.name} connected! You can now use it on WhatsApp.`);
        return;
      }
      setToast(`Verifying ${connected} connection…`);
      void (async () => {
        try {
          await api(user, "/api/me/connectors/confirm", {
            method: "POST",
            body: JSON.stringify({ toolkit: connected }),
          });
        } catch {
          // Fallback to /api/me check below
        }
        const refreshed = await load();
        const app = refreshed?.connections.find((c) => c.slug === connected);
        if (app?.status === "active") {
          setToast(`✓ ${app.name} connected! You can now use it on WhatsApp.`);
        } else {
          setToast(`${app?.name || connected} status updated.`);
        }
      })();
      return;
    }
    if (!initialMe) {
      void load();
    }
  }, [initialMe, load, user]);

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
      const res = await api<UpgradeResponse>(user, "/api/me/upgrade", {
        method: "POST", body: JSON.stringify({ plan: requestedPlan || "pro" }),
      });
      await launchRazorpayCheckout(res);
    } catch (e: any) {
      setToast(`⚠️ ${e.message}`);
    }
  }

  const waLink = me?.whatsapp_number ? `https://wa.me/${me.whatsapp_number}?text=${encodeURIComponent(prompt)}` : "";
  const connectedCount = me?.connections.filter((c) => c.status === "active").length ?? 0;
  const upgradePlan = me?.available_plans.find((plan) => plan.id === (requestedPlan || "pro"));
  const pct = me ? Math.min(100, Math.round((me.usage.used_today / Math.max(1, me.usage.daily_limit)) * 100)) : 0;

  return (
    <div className={homeStyles.site}>
      <header style={{ borderBottom: "1px solid #d8e4dc", background: "rgba(255, 253, 250, 0.92)", backdropFilter: "blur(18px)" }} className="sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs" style={{ color: "#5e6d63" }}>{user.phoneNumber}</span>
            <button onClick={() => { void onSetup().catch((cause) => setToast(cause instanceof Error ? cause.message : "Couldn’t reopen setup")); }} className="text-xs px-3 py-2 rounded-lg" style={{ border: "1px solid #cce0d4", background: "#fff", color: "#18241d" }}>Personalize</button>
            <button onClick={logoutSession} className="text-xs px-3 py-2 rounded-lg" style={{ border: "1px solid #cce0d4", background: "#fff", color: "#18241d" }}>
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
          {waLink && <a href={waLink} target="_blank" rel="noreferrer" className={`${homeStyles.button} ${homeStyles.darkButton}`}>
            💬 Chat with Astra on WhatsApp
          </a>}
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
            {me && upgradePlan && (!me.plan.is_premium || (requestedPlan && me.plan.name.toLowerCase() !== requestedPlan)) && (
              <button onClick={upgrade} className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "#1b7a4e", color: "#fff" }}>
                {requestedPlan ? `Continue with ${upgradePlan.name}` : "Upgrade"} · ₹{upgradePlan.price_inr}/mo
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

        {me?.whatsapp_number && <ContactChannels number={me.whatsapp_number} prompt={prompt} subtitle={`Use the WhatsApp number you verified: ${user.phoneNumber}.`} />}
      </main>
    </div>
  );
}

function AppLoadingScreen({ title, description, error, onRetry }: { title: string; description: string; error?: string; onRetry?: () => void }) {
  return (
    <div className={homeStyles.site}>
      <header style={{ borderBottom: "1px solid #d8e4dc", background: "rgba(255, 253, 250, 0.92)", backdropFilter: "blur(18px)" }} className="sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Logo />
        </div>
      </header>
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#1b7a4e" }}>Your Astra</p>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#18241d" }}>{title}</h1>
        <p className="text-sm" style={{ color: error ? "#8c2d2d" : "#5e6d63" }}>{error || description}</p>
        {error && onRetry && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={onRetry} className={`${homeStyles.button} ${homeStyles.darkButton}`}>Try again</button>
            <button onClick={logoutSession} className={`${homeStyles.button} ${homeStyles.lightButton}`}>Sign out</button>
          </div>
        )}
      </main>
    </div>
  );
}

export function AccountEntry({ user }: { user: SessionUser }) {
  const [account, setAccount] = useState<Me | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [editingSetup, setEditingSetup] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState(GREETING);
  const [requestedPlan, setRequestedPlan] = useState<"pro" | "business" | undefined>();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = `astra:entry:${user.uid}`;
    let resume: { prompt?: string; plan?: string } = {};
    try {
      // Resume the chosen recipe/plan after OAuth, without carrying it across users.
      if (params.has("connected")) resume = JSON.parse(sessionStorage.getItem(key) || "{}") || {};
    } catch { /* Storage may be disabled; login and chat still work. */ }
    const savedPrompt = typeof resume.prompt === "string" ? resume.prompt : "";
    const prompt = (params.get("prompt") || savedPrompt).slice(0, 2000) || GREETING;
    const paid = params.get("paid") === "1";
    const plan = paid ? undefined : (params.get("plan") || resume.plan);
    setPrompt(prompt);
    if (plan === "pro" || plan === "business") setRequestedPlan(plan);
    try { sessionStorage.setItem(key, JSON.stringify({ prompt, plan })); } catch { /* Optional resume only. */ }
  }, [user.uid]);
  const load = useCallback(async () => {
    setError("");
    const onboardedKey = `astra:onboarded:${user.uid}`;
    const connectedSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("connected") : null;
    const returningFromOAuth = Boolean(connectedSlug);
    let alreadyOnboarded = returningFromOAuth;
    try {
      if (localStorage.getItem(onboardedKey) === "1") alreadyOnboarded = true;
    } catch { /* ignore */ }
    try {
      await api(user, "/api/me/session", { method: "POST" });
      if (connectedSlug) {
        await api(user, "/api/me/connectors/confirm", {
          method: "POST",
          body: JSON.stringify({ toolkit: connectedSlug }),
        }).catch(() => {});
      }
      const [profile, preferences] = await Promise.all([
        api<Me>(user, "/api/me"), api<Setup>(user, "/api/me/onboarding"),
      ]);
      const hasExistingActivity =
        alreadyOnboarded ||
        preferences.completed ||
        Boolean(profile.name) ||
        profile.plan.is_premium ||
        profile.connections.some((c) => c.status === "active");
      let resolvedSetup = preferences;
      if (hasExistingActivity && !preferences.completed) {
        resolvedSetup = { ...preferences, step: "complete", completed: true };
        void api<Setup>(user, "/api/me/onboarding", {
          method: "PATCH",
          body: JSON.stringify({ step: "complete" }),
        }).catch(() => {});
      }
      if (resolvedSetup.completed) {
        try { localStorage.setItem(onboardedKey, "1"); } catch { /* ignore */ }
      }
      setAccount(profile);
      setSetup(resolvedSetup);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t load your account"); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  // Pay buttons (/app?plan=…): open Razorpay as soon as the verified account is known, with no setup detour.
  // If checkout can't start, fall back to the normal flow, whose plan buttons show the error.
  const [checkingOut, setCheckingOut] = useState(false);
  const checkoutStarted = useRef(false);
  useEffect(() => {
    if (!account || !requestedPlan || checkoutStarted.current) return;
    if (account.plan.is_premium && account.plan.name.toLowerCase() === requestedPlan) return;
    checkoutStarted.current = true;
    setCheckingOut(true);
    api<UpgradeResponse>(user, "/api/me/upgrade", { method: "POST", body: JSON.stringify({ plan: requestedPlan }) })
      .then((res) => {
        if (!res.payment_url && !res.checkout) throw new Error("No checkout link");
        return launchRazorpayCheckout(res, () => setCheckingOut(false));
      })
      .catch(() => setCheckingOut(false));
  }, [account, requestedPlan, user]);

  async function save(patch: SetupPatch) {
    const saved = await api<Setup>(user, "/api/me/onboarding", { method: "PATCH", body: JSON.stringify(patch) });
    if (saved.completed) {
      try { localStorage.setItem(`astra:onboarded:${user.uid}`, "1"); } catch { /* ignore */ }
    }
    setSetup(saved);
    return saved;
  }
  async function reopen() {
    setEditingSetup(true);
  }

  if (checkingOut) {
    return (
      <AppLoadingScreen
        title="Opening secure checkout…"
        description={`Taking you to Razorpay to finish your ${requestedPlan === "business" ? "Business" : "Pro"} plan.`}
      />
    );
  }
  if (setup?.completed && !editingSetup) {
    return <Dashboard user={user} initialMe={account} onSetup={reopen} prompt={prompt} requestedPlan={requestedPlan} />;
  }
  if (!account || !setup) {
    const isOAuthReturn = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("connected");
    return (
      <AppLoadingScreen
        title={error ? "Let’s try that again." : isOAuthReturn ? "Finishing app connection…" : "Loading your Astra…"}
        description="Getting your account and connected apps ready."
        error={error}
        onRetry={() => void load()}
      />
    );
  }
  return <Onboarding account={account} setup={editingSetup ? { ...setup, step: "name", completed: false } : setup} save={save}
    onComplete={(state) => {
      setEditingSetup(false);
      setSetup({ ...state, completed: true, step: "complete" });
    }}
    requestedPlan={requestedPlan}
    connect={async (slug) => {
      const result = await api<{ auth_url: string }>(user, "/api/me/connectors/link", { method: "POST", body: JSON.stringify({ toolkit: slug }) });
      if (!result.auth_url) throw new Error("No connection link was returned. Please try again.");
      try { localStorage.setItem(`astra:onboarded:${user.uid}`, "1"); } catch { /* ignore */ }
      await api<Setup>(user, "/api/me/onboarding", { method: "PATCH", body: JSON.stringify({ step: "complete" }) }).catch(() => {});
      window.location.assign(result.auth_url);
    }}
    checkout={async (plan) => {
      const result = await api<UpgradeResponse>(user, "/api/me/upgrade", { method: "POST", body: JSON.stringify({ plan }) });
      if (!result.payment_url && !result.checkout) throw new Error("No checkout link was returned. You can continue for free.");
      await save({ step: "complete" });
      await launchRazorpayCheckout(result);
    }} />;
}

export default function AstraApp() {
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);
  const [waUser, setWaUser] = useState<SessionUser | null>(() => loadWhatsAppSession());
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);
  useEffect(() => {
    const sync = () => {
      const next = loadWhatsAppSession();
      setWaUser((prev) => (prev?.uid === next?.uid ? prev : next));
    };
    sync();
    return subscribeWhatsAppSession(sync);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("wa_token");
    if (!ticket) return;
    params.delete("wa_token");
    const rest = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    setExchanging(true);
    publicApi<{ token: string; phone_number: string }>("/api/me/whatsapp-login/exchange", {
      method: "POST",
      body: JSON.stringify({ ticket }),
    })
      .then((res) => {
        if (res.token && res.phone_number) {
          saveWhatsAppSession(res.token, res.phone_number);
        }
      })
      .catch(() => { /* Expired link falls back to Login screen */ })
      .finally(() => setExchanging(false));
  }, []);

  const activeUser: SessionUser | null | undefined = waUser || firebaseUser;
  useEffect(() => {
    if (activeUser !== null) return;
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (params.get("paid") !== "1" && (plan === "pro" || plan === "business")) {
      window.location.replace(`/payment/checkout?plan=${plan}`);
    }
  }, [activeUser]);

  if (exchanging || (activeUser === undefined && !waUser)) {
    return <AppLoadingScreen title="Opening Astra…" description="Checking your sign-in session." />;
  }
  return activeUser ? <AccountEntry key={activeUser.uid} user={activeUser} /> : <Login onBack={() => window.location.assign("/")} />;
}
