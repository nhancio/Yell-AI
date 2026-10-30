"use client";

import { useState } from "react";
import Onboarding, { SetupFrame } from "@/components/onboarding/Onboarding";
import type { Account, Setup, SetupStep } from "@/lib/account";
import s from "@/components/onboarding/onboarding.module.css";

const initial: Setup = { name: "Nithin", interests: ["email", "automations", "daily_brief", "travel"], step: "interests", completed: false, completed_at: null };
const sample: Account = {
  phone_number: "", name: "Nithin", member_since: null,
  plan: { is_premium: false, name: "Free", expires_at: null, price_inr: 99 },
  usage: { used_today: 0, daily_limit: 15 }, whatsapp_number: "",
  connections: [
    { slug: "gmail", name: "Gmail", icon: "", description: "", category: "Google Workspace", status: "disconnected", configured: true },
    { slug: "googlecalendar", name: "Google Calendar", icon: "", description: "", category: "Google Workspace", status: "disconnected", configured: true },
    { slug: "notion", name: "Notion", icon: "", description: "", category: "Productivity", status: "disconnected", configured: true },
  ],
  available_plans: [
    { id: "pro", name: "Pro", price_inr: 99, daily_limit: 80 },
    { id: "business", name: "Business", price_inr: 999, daily_limit: 1000 },
  ],
};

export default function Preview() {
  const [setup, setSetup] = useState(initial);
  const [account, setAccount] = useState(sample);
  const [version, setVersion] = useState(0);
  const [done, setDone] = useState("");
  function show(step: SetupStep) {
    setDone(""); setSetup((current) => ({ ...current, step, completed: false })); setVersion((current) => current + 1);
  }
  return <>
    <nav className={s.previewBar} aria-label="Development preview controls">
      <span>Local preview · no external actions</span>
      {(["name", "interests", "apps", "ready", "plan"] as SetupStep[]).map((step) => <button key={step} onClick={() => show(step)}>{step === "plan" ? "Plans" : step.charAt(0).toUpperCase() + step.slice(1)}</button>)}
    </nav>
    {done ? <SetupFrame index={6}><h1 className={s.heading}>Preview complete.</h1><p className={s.description}>{done}</p><button className={s.primary} onClick={() => show("name")}>Start again</button></SetupFrame> :
      <Onboarding key={version} account={account} setup={setup}
        save={async (patch) => {
          const next = { ...setup, ...patch, completed: patch.step === "complete" };
          setSetup(next); return next;
        }}
        connect={async (slug) => setAccount((current) => ({ ...current, connections: current.connections.map((app) => app.slug === slug ? { ...app, status: "active" } : app) }))}
        checkout={async (plan) => setDone(`Selected ${plan}. Production opens the existing payment checkout; this preview creates no payment.`)}
        onComplete={() => setDone("Your setup is saved. No account, message, or payment was created in this preview.")} />}
  </>;
}
