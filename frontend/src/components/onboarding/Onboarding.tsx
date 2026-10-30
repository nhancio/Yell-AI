"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { INTERESTS, type Account, type Interest, type Plan, type Setup, type SetupPatch, type SetupStep } from "@/lib/account";
import Icon from "./Icon";
import s from "./onboarding.module.css";

const STEPS = ["Phone number", "Verification", "Your name", "Your interests", "Your apps", "Your space", "Your plan"];
const SETUP_STEPS: SetupStep[] = ["name", "interests", "apps", "ready", "plan"];
const INTEREST_ROWS = Array.from({ length: 5 }, (_, row) => INTERESTS.slice(row * 3, row * 3 + 3));

export function SetupFrame({ index, children, skip, busy = false }: {
  index: number; children: ReactNode; skip?: { label: string; action: () => void }; busy?: boolean;
}) {
  return <main className={s.screen}>
    <div className={s.flow}>
      <nav className={s.progressRow} aria-label="Onboarding">
        <ol className={s.dots} aria-label={`Step ${index + 1} of ${STEPS.length}: ${STEPS[index]}`}>
          {STEPS.map((label, i) => <li key={label} aria-current={i === index ? "step" : undefined}>
            <span className={`${s.dot} ${i < index ? s.visited : ""} ${i === index ? s.current : ""}`} />
            <span className={s.srOnly}>{label}</span>
          </li>)}
        </ol>
        {skip && <button type="button" className={s.skip} onClick={skip.action} disabled={busy}>{skip.label}</button>}
      </nav>
      {children}
    </div>
  </main>;
}

interface Props {
  account: Account;
  setup: Setup;
  save: (patch: SetupPatch) => Promise<Setup>;
  connect: (slug: string) => Promise<void>;
  checkout: (plan: Plan["id"]) => Promise<void>;
  onComplete: (state: Setup) => void;
}

export default function Onboarding({ account, setup, save, connect, checkout, onComplete }: Props) {
  const [step, setStep] = useState<SetupStep>(setup.step === "complete" ? "name" : setup.step);
  const [name, setName] = useState(setup.name || "");
  const [selected, setSelected] = useState<Interest[]>(setup.interests);
  const [selectedPlan, setSelectedPlan] = useState<Plan["id"]>("pro");
  const [busy, setBusy] = useState(false);
  const [busyApp, setBusyApp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [allApps, setAllApps] = useState(false);
  const index = SETUP_STEPS.indexOf(step);
  const fullName = name.trim();
  const enabledApps = account.connections.filter((app) => app.configured);
  const visibleApps = allApps ? enabledApps : enabledApps.filter((app) => ["gmail", "googlecalendar", "notion"].includes(app.slug));
  const connectedCount = enabledApps.filter((app) => app.status === "active").length;
  const plans = account.available_plans || [];
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (step !== "name") content.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [step]);

  async function advance(next: SetupStep) {
    setBusy(true);
    setError("");
    try {
      const result = await save({ name: fullName || null, interests: selected, step: next });
      setName(result.name || "");
      setSelected(result.interests);
      if (next === "complete") onComplete(result);
      else setStep(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t save your setup. Please try again.");
    } finally { setBusy(false); }
  }

  function toggle(id: Interest) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function connectApp(slug: string) {
    setBusy(true); setBusyApp(slug); setError("");
    try {
      await save({ name: fullName || null, interests: selected, step: "apps" });
      await connect(slug);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t open this connection. Please try again.");
    } finally { setBusy(false); setBusyApp(null); }
  }

  async function startCheckout() {
    setBusy(true); setError("");
    try { await checkout(selectedPlan); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Checkout is unavailable. You can continue for free."); }
    finally { setBusy(false); }
  }

  function goBack() {
    void advance(SETUP_STEPS[Math.max(0, index - 1)]);
  }

  const next = SETUP_STEPS[index + 1] || "complete";
  const skip = { label: step === "plan" ? "Not now" : "Set up later", action: () => { void advance(next); } };
  const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);

  return <SetupFrame index={index + 2} skip={skip} busy={busy}>
    <section ref={content} key={step} className={s.content} aria-busy={busy}>
      {step === "name" && <>
        <h1 tabIndex={-1} className={s.heading}>Let’s make this yours.<br />What should we call you?</h1>
        <p className={s.description}>A little introduction goes a long way.</p>
        <form className={s.form} onSubmit={(event) => { event.preventDefault(); void advance("interests"); }}>
          <label htmlFor="setup-name" className={s.label}>Your name</label>
          <input id="setup-name" className={s.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your first name" autoComplete="given-name" maxLength={128} disabled={busy} autoFocus />
          <button className={s.primary} disabled={busy || !fullName}>{busy ? "Saving…" : "Continue"}</button>
        </form>
      </>}

      {step === "interests" && <>
        <h1 tabIndex={-1} className={s.heading}>What should Astra handle<br />for you{fullName ? `, ${fullName}` : ""}?</h1>
        <p className={s.helper}>Pick a few to start</p>
        <div className={s.chips} role="group" aria-label="Your interests">
          {INTEREST_ROWS.map((row, index) => <div className={s.chipRow} key={index}>
            {row.map(([id, label]) => <button key={id} type="button" className={s.chip} aria-pressed={selected.includes(id)} onClick={() => toggle(id)} disabled={busy}><Icon name={id} />{label}</button>)}
          </div>)}
        </div>
        <button className={s.primary} onClick={() => void advance("apps")} disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
      </>}

      {step === "apps" && <>
        <h1 tabIndex={-1} className={s.heading}>A little more connected.<br />A little less to do.</h1>
        <p className={s.description}>Link the apps you’d like to use with Astra. You choose what to connect, and can disconnect any time.</p>
        <div className={s.apps}>
          {visibleApps.map((app) => {
            const active = app.status === "active";
            const icon = app.slug === "gmail" ? "email" : app.slug === "googlecalendar" ? "calendar" : app.slug === "notion" ? "notes" : app.slug === "github" ? "coding" : "link";
            return <div className={s.appRow} key={app.slug}>
              <span className={s.appIcon}><Icon name={icon} size={20} /></span>
              <div className={s.appInfo}><strong>{app.name}</strong><span>{active ? "Ready to use" : app.status === "pending" ? "Authorization pending" : app.category}</span></div>
              <button className={`${s.connectButton} ${active ? s.connected : ""}`} disabled={busy || active} onClick={() => void connectApp(app.slug)} aria-label={active ? `${app.name} connected` : `Connect ${app.name}`}>
                {busyApp === app.slug ? "Opening…" : active ? <><Icon name="check" size={12} />Connected</> : app.status === "pending" ? "Try again" : "Connect"}
              </button>
            </div>;
          })}
        </div>
        {enabledApps.length > 3 && <div className={s.appActions}><button className={s.textButton} onClick={() => setAllApps(!allApps)} disabled={busy}>{allApps ? "Show fewer apps" : `See all ${enabledApps.length} apps`}</button></div>}
        {enabledApps.length === 0 && <p className={s.smallNote}>App connections are currently unavailable. You can add them from your account later.</p>}
        <button className={s.primary} onClick={() => void advance("ready")} disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
      </>}

      {step === "ready" && <>
        <h1 tabIndex={-1} className={s.heading}>Your space is ready{fullName ? `, ${fullName}` : ""}.</h1>
        <p className={s.description}>Your preferences are saved. You can change them and connect more apps whenever you like.</p>
        <div className={s.summary}>
          <div className={s.summaryRow}><Icon name="check" size={20} />Your phone number is verified</div>
          <div className={s.summaryRow}><Icon name="notes" size={20} />{selected.length ? `${selected.length} interests to make it yours` : "Room to explore at your own pace"}</div>
          <div className={s.summaryRow}><Icon name="link" size={20} />{connectedCount ? `${connectedCount} ${connectedCount === 1 ? "app" : "apps"} connected` : "Connect your apps when you’re ready"}</div>
        </div>
        <button className={s.primary} onClick={() => void advance("plan")} disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
      </>}

      {step === "plan" && <>
        <h1 tabIndex={-1} className={s.heading}>Get more from Astra<span className={s.headingMuted}>Choose a plan, or start for free</span></h1>
        <span className={s.period}>Monthly plans</span>
        <fieldset className={s.plans}>
          <legend className={s.srOnly}>Choose your plan</legend>
          {plans.map((plan) => <label className={`${s.planCard} ${selectedPlan === plan.id ? s.selectedPlan : ""}`} key={plan.id}>
            <input className={s.srOnly} type="radio" name="setup-plan" value={plan.id} checked={selectedPlan === plan.id} onChange={() => setSelectedPlan(plan.id)} disabled={busy} />
            <span className={s.planName}>{plan.name}</span>
            <span className={s.planDescription}>{plan.id === "pro" ? "More room for the everyday things you ask Astra." : "A larger allowance for the days you have more to do."}</span>
            <span className={s.price}>{money(plan.price_inr)} <small>/ month</small></span>
            <span className={s.billingNote}>30 days of access</span>
            {plan.id === "business" && <>
              <span className={s.featuresTitle}>A little more breathing room:</span>
              <ul className={s.features}>
                <li><Icon name="check" size={12} />Up to {plan.daily_limit.toLocaleString("en-IN")} messages each day</li>
                <li><Icon name="check" size={12} />Use your connected apps</li>
                <li><Icon name="check" size={12} />Your preferences stay with your account</li>
              </ul>
            </>}
            {plan.id === "pro" && <span className={s.billingNote}>Up to {plan.daily_limit.toLocaleString("en-IN")} messages each day</span>}
          </label>)}
        </fieldset>
        {plans.length > 0 && <button className={s.primary} onClick={() => void startCheckout()} disabled={busy}>{busy ? "Opening checkout…" : "Continue to checkout"}</button>}
        <div className={s.footer}><button className={s.textButton} onClick={() => void advance("complete")} disabled={busy}>Continue for free</button></div>
      </>}

      {error && <p className={s.error} role="alert">{error}</p>}
      {index > 0 && <div className={s.footer}><button className={s.textButton} onClick={goBack} disabled={busy}>← Back</button></div>}
    </section>
  </SetupFrame>;
}
