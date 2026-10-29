"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const WHATSAPP_NUMBER = "12057820175";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" && window.location.hostname !== "localhost" ? "" : "http://localhost:8000");

interface ConnectorItem {
  slug: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  status: string;
  auth_url?: string | null;
}

const DEFAULT_CONNECTORS: ConnectorItem[] = [
  {
    slug: "gmail",
    name: "Gmail",
    icon: "📧",
    description: "Read emails, send replies, track IRCTC PNR & Swiggy/Zomato/Amazon receipts",
    category: "Google Workspace",
    status: "disconnected",
  },
  {
    slug: "googlecalendar",
    name: "Google Calendar",
    icon: "📅",
    description: "Auto-schedule meetings, check free/busy, set reminders & Google Meet links",
    category: "Google Workspace",
    status: "disconnected",
  },
  {
    slug: "notion",
    name: "Notion",
    icon: "📝",
    description: "Save notes, manage daily tasks, second-brain pages & project trackers",
    category: "Productivity",
    status: "disconnected",
  },
  {
    slug: "github",
    name: "GitHub",
    icon: "🐙",
    description: "Review PRs, check repo issues, and power founder/job outreach",
    category: "Developer & Career",
    status: "disconnected",
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    description: "Draft posts, optimize profile, and power Backdoor founder/hiring outreach",
    category: "Developer & Career",
    status: "disconnected",
  },
  {
    slug: "googlesheets",
    name: "Google Sheets",
    icon: "📊",
    description: "Track expenses, UPI budgets, founder outreach lists, and CRM rows",
    category: "Google Workspace",
    status: "disconnected",
  },
  {
    slug: "googledrive",
    name: "Google Drive & Docs",
    icon: "📁",
    description: "Find PDFs, resumes, invoices, and summarize documents in WhatsApp",
    category: "Google Workspace",
    status: "disconnected",
  },
  {
    slug: "slack",
    name: "Slack",
    icon: "💬",
    description: "Catch urgent work pings and reply right from WhatsApp",
    category: "Work Chat",
    status: "disconnected",
  },
];

function ConnectHubInner() {
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone") || "";
  const connectedParam = searchParams.get("connected") || "";
  const setupParam = searchParams.get("setup") || "";

  const [phone, setPhone] = useState(initialPhone.replace(/^91/, ""));
  const [connectors, setConnectors] = useState<ConnectorItem[]>(DEFAULT_CONNECTORS);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cleanDigits = phone.replace(/\D/g, "");
  const fullPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

  useEffect(() => {
    if (connectedParam && fullPhone) {
      fetch(`${BACKEND_URL}/api/connectors/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: fullPhone, toolkit: connectedParam }),
      })
        .then(() => {
          setToast(`✅ ${connectedParam.toUpperCase()} connected! You can now use it inside WhatsApp.`);
          fetchStatus(fullPhone);
        })
        .catch(() => {});
    } else if (fullPhone.length >= 10) {
      fetchStatus(fullPhone);
    }
  }, [connectedParam, fullPhone]);

  async function fetchStatus(targetPhone: string) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/connectors/status?phone=${targetPhone}`);
      if (res.ok) {
        const data = await res.json();
        if (data.connections) {
          setConnectors(data.connections);
        }
      }
    } catch {
      // fallback to local state if backend is offline
    }
  }

  async function handleConnect(toolkitSlug: string, sendToWhatsApp = false) {
    if (fullPhone.length < 10) {
      setToast("⚠️ Please enter your 10-digit WhatsApp mobile number first!");
      return;
    }
    setLoadingSlug(toolkitSlug);
    setToast(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/connectors/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: fullPhone,
          toolkit: toolkitSlug,
          redirect_url: `${window.location.origin}/connect?phone=${fullPhone}&connected=${toolkitSlug}`,
          send_whatsapp_link: sendToWhatsApp,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (sendToWhatsApp) {
          setToast(`📲 Sent 1-tap ${data.toolkit_name} link to your WhatsApp (+${fullPhone})!`);
        } else if (data.auth_url && !data.auth_url.includes("/connect?")) {
          window.location.href = data.auth_url;
          return;
        } else {
          // Demo / local fallback confirmation
          await fetch(`${BACKEND_URL}/api/connectors/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone_number: fullPhone, toolkit: toolkitSlug }),
          });
          await fetchStatus(fullPhone);
          setToast(`✅ ${data.toolkit_name} linked to +${fullPhone}! Return to WhatsApp to test it.`);
        }
      } else {
        setToast("⚠️ Could not reach backend API. Make sure FastAPI is running on :8000.");
      }
    } catch {
      setToast("⚠️ Backend server not reachable. Start `./run.sh` to enable live Composio OAuth.");
    } finally {
      setLoadingSlug(null);
    }
  }

  const waReturnUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("I connected my apps! What can we do first?")}`;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <header className="border-b border-white/10 bg-[#070b14]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#25D366] text-black font-black flex items-center justify-center">
              Y
            </div>
            <span className="font-bold text-lg text-white">Yell AI</span>
            <span className="text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              1-Tap Connect Hub
            </span>
          </Link>

          <a
            href={waReturnUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-4 py-2 rounded-xl text-xs md:text-sm transition"
          >
            💬 Back to WhatsApp Chat →
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            Connect Once. Use Everything in WhatsApp. 🇮🇳
          </h1>
          <p className="text-slate-400 mt-3 text-sm md:text-base">
            Link your WhatsApp number below and authorize the apps you want Yell AI to control via Composio OAuth.
          </p>
        </div>

        {/* Phone Number Bar */}
        <div className="max-w-xl mx-auto mb-10 rounded-2xl border border-white/15 bg-slate-900/90 p-5 shadow-xl">
          <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
            Your WhatsApp Number (Identity Key)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center bg-black/60 border border-white/15 rounded-xl px-4 py-3 flex-1">
              <span className="text-slate-400 font-semibold text-sm mr-2">🇮🇳 +91</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter 10-digit WhatsApp number"
                maxLength={12}
                className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full font-medium"
              />
            </div>
            <button
              onClick={() => fullPhone && fetchStatus(fullPhone)}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white transition"
            >
              Sync Status
            </button>
          </div>
          {toast && (
            <div className="mt-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-xs md:text-sm text-emerald-300">
              {toast}
            </div>
          )}
        </div>

        {/* Connectors Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          {connectors.map((c) => {
            const isConnected = c.status === "active";
            const isHighlighted = setupParam === c.slug;
            return (
              <div
                key={c.slug}
                className={`rounded-2xl border p-6 transition flex flex-col justify-between ${
                  isConnected
                    ? "border-emerald-500/50 bg-emerald-950/20"
                    : isHighlighted
                    ? "border-amber-400/60 bg-slate-900"
                    : "border-white/10 bg-slate-900/60 hover:border-white/20"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{c.icon}</span>
                      <div>
                        <h3 className="text-lg font-bold text-white">{c.name}</h3>
                        <span className="text-[11px] text-slate-400">{c.category}</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        isConnected
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-white/5 text-slate-400 border border-white/10"
                      }`}
                    >
                      {isConnected ? "✓ Connected" : "Not Linked"}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed mt-2">
                    {c.description}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleConnect(c.slug, false)}
                    disabled={loadingSlug === c.slug}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm transition ${
                      isConnected
                        ? "bg-white/10 text-white hover:bg-white/15"
                        : "bg-[#25D366] hover:bg-[#1ebe5d] text-black"
                    }`}
                  >
                    {loadingSlug === c.slug
                      ? "Connecting..."
                      : isConnected
                      ? "Reconnect OAuth"
                      : `Connect ${c.name} →`}
                  </button>
                  <button
                    onClick={() => handleConnect(c.slug, true)}
                    disabled={loadingSlug === c.slug}
                    className="py-2.5 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition"
                    title="Send magic link to my WhatsApp"
                  >
                    📲 Send to WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070b14] text-white p-10 text-center">Loading Connect Hub...</div>}>
      <ConnectHubInner />
    </Suspense>
  );
}
