"use client";

import Link from "next/link";
import ContactChannels from "@/components/ContactChannels";
import { useState, useEffect } from "react";
import QRCode from "qrcode";

const WHATSAPP_NUMBER = "15552107308";
const APP_URL = "https://yellapp.nhancio.com";

const INDIA_USE_CASES = [
  {
    tag: "Poke for India • Executive Assistant",
    title: "Inbox, Calendar & Reminders in Hinglish",
    prompt: "Bhai, kal subah 11 baje Rahul ke saath Google Meet lagao aur uska last mail summarize karo.",
    reply: "✅ Done! Google Calendar invite sent to rahul@startup.in for 11:00 AM IST tomorrow.\\n\\n📧 *Last Email Summary:* Rahul shared the Q4 deck and asked for final pricing approval before Friday.",
    connectors: ["Gmail", "Google Calendar"],
  },
  {
    tag: "Backdoor • Direct Founder Hiring",
    title: "Skip Job Portals. DM Startup Founders Directly.",
    prompt: "Find top funded AI startups in Bengaluru hiring full-stack engineers and draft a cold email from my GitHub.",
    reply: "🚀 Found 3 newly funded BLR startups (Sarvam, Composio, Smallest AI).\\n\\nDrafted a custom 4-line cold email referencing your top GitHub repo. Reply *SEND* to mail the CTO directly from your Gmail!",
    connectors: ["GitHub", "Gmail", "LinkedIn"],
  },
  {
    tag: "Instinct • India Life-OS",
    title: "IRCTC Trains, Flights, Swiggy & UPI Budgets",
    prompt: "Check my IRCTC PNR from Gmail and tell me my total Swiggy + Blinkit spend this month.",
    reply: "🚆 *Train 12951 Rajdhani:* Confirmed! Coach B4, Berth 21 (Departs 17:00 IST).\\n\\n💸 *Monthly Food & Quick-Commerce:* ₹6,420 across 14 Swiggy & Blinkit receipts in Gmail.",
    connectors: ["Gmail", "Google Sheets"],
  },
];

const CONNECTORS = [
  { slug: "gmail", name: "Gmail", icon: "📧", desc: "Read/send emails, PNR & order receipts" },
  { slug: "googlecalendar", name: "Google Calendar", icon: "📅", desc: "Book meetings, Meet links & reminders" },
  { slug: "notion", name: "Notion", icon: "📝", desc: "Save notes, tasks & second-brain docs" },
  { slug: "github", name: "GitHub", icon: "🐙", desc: "Repo insights, PRs & founder outreach" },
  { slug: "linkedin", name: "LinkedIn", icon: "💼", desc: "Backdoor hiring & founder cold outreach" },
  { slug: "googlesheets", name: "Google Sheets", icon: "📊", desc: "Auto-log UPI budgets, expenses & leads" },
  { slug: "googledrive", name: "Google Drive", icon: "📁", desc: "Search PDFs, resumes & invoices" },
  { slug: "slack", name: "Slack", icon: "💬", desc: "Catch urgent work pings on WhatsApp" },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Yell AI!")}`;

  useEffect(() => {
    QRCode.toDataURL(waLink, {
      width: 180,
      margin: 1,
      color: { dark: "#000000", light: "#25D366" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR generation error:", err));
  }, [waLink]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black font-sans">
      {/* Top Announcement Banner */}
      <div className="bg-gradient-to-r from-orange-500/20 via-emerald-500/20 to-sky-500/20 border-b border-white/10 px-4 py-2 text-center text-xs md:text-sm text-slate-200">
        🇮🇳 <span className="font-semibold text-emerald-400">Built for Bharat:</span> Zero app download. Text on WhatsApp to manage emails, schedule meets, draft founder pitches & track your life. <Link href="/brands" className="underline font-medium ml-1 text-white hover:text-emerald-300">Brands Portal →</Link>
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#070b14]/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black font-black text-lg shadow-lg shadow-emerald-500/20">
              Y
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">Yell AI</span>
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                India Beta
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-300">
            <a href="#how-it-works" className="hover:text-white transition">How it Works</a>
            <a href="#connectors" className="hover:text-white transition">Composio Connectors</a>
            <a href="#pricing" className="hover:text-white transition">Pricing (₹)</a>
            <Link href="/brands" className="hover:text-emerald-400 transition font-medium flex items-center gap-1">
              ⚡ Brands Portal
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={APP_URL}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium transition"
            >
              🔌 Yell App
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold px-4 py-2 rounded-xl text-sm shadow-lg shadow-[#25D366]/25 transition"
            >
              <span>💬 Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Clean Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm text-slate-300 mb-6">
              <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
              No login wall. No new app. Lives 100% inside your WhatsApp.
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
              Your Entire Digital Life.
              <span className="block mt-2 bg-gradient-to-r from-[#25D366] via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                Inside WhatsApp. 🇮🇳
              </span>
            </h1>

            <p className="mt-6 text-base md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Manage Gmail, book Google Calendar meets, backdoor cold-email startup founders, and track IRCTC trains & Swiggy spends — all through voice notes & Hinglish texts.
            </p>

            {/* Frictionless Dual Launch Action */}
            <div className="mt-10 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1ebe5d] text-black font-extrabold px-8 py-4 rounded-2xl text-lg transition flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/25"
              >
                <span className="text-2xl">💬</span>
                <span>Chat on WhatsApp Now →</span>
              </a>

              <Link
                href="/brands"
                className="w-full sm:w-auto px-6 py-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold text-base transition flex items-center justify-center gap-2"
              >
                <span>⚡ Brands & Ads Portal →</span>
              </Link>
            </div>

            {/* Desktop Scan to Chat QR Callout */}
            {qrDataUrl && (
              <div className="hidden md:inline-flex items-center gap-4 mt-8 px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-left">
                <img
                  src={qrDataUrl}
                  alt="Scan to Chat on WhatsApp"
                  className="w-16 h-16 rounded-xl border border-white/10 shadow"
                />
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>📱 Scan on Desktop</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">+1 555-210-7308</span>
                  </div>
                  <p className="text-slate-400 mt-0.5">Point your phone camera to start chatting on WhatsApp instantly.</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span>⚡ Powered by Composio OAuth</span>
              <span>•</span>
              <span>🗣️ Speaks English, Hinglish & Hindi</span>
              <span>•</span>
              <span>🔒 Zero Password / Instant Access</span>
            </div>
          </div>

          {/* Interactive Demo Cards */}
          <div className="max-w-4xl mx-auto mt-16">
            <div className="flex justify-center gap-2 mb-4 overflow-x-auto pb-2">
              {INDIA_USE_CASES.map((uc, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition whitespace-nowrap ${
                    activeTab === i
                      ? "bg-[#25D366] text-black shadow-lg shadow-[#25D366]/20"
                      : "bg-white/5 text-slate-400 hover:text-white border border-white/10"
                  }`}
                >
                  {uc.tag.split(" • ")[1] || uc.tag}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/90 to-black/90 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  {INDIA_USE_CASES[activeTab].tag}
                </span>
                <div className="flex gap-1.5">
                  {INDIA_USE_CASES[activeTab].connectors.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm shadow-md">
                    <p className="font-medium">{INDIA_USE_CASES[activeTab].prompt}</p>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-none px-4 py-3 max-w-[90%] text-sm shadow-md space-y-2">
                    <p className="whitespace-pre-line leading-relaxed">
                      {INDIA_USE_CASES[activeTab].reply}
                    </p>
                    <div className="text-[10px] text-slate-400 text-right">Delivered via WhatsApp</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1-Tap Connectors Section */}
        <section id="connectors" className="py-16 px-4 border-t border-white/10 bg-slate-950/50">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">
              Connect Once. Control Forever.
            </h2>
            <p className="text-slate-400 mt-2 text-sm md:text-base max-w-xl mx-auto">
              Link your everyday tools securely via Composio OAuth. Yell AI acts on your behalf only when instructed.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
              {CONNECTORS.map((c) => (
                <div
                  key={c.slug}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] p-5 text-left transition duration-200"
                >
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <div className="font-bold text-white text-base">{c.name}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-relaxed">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works in 3 steps */}
        <section id="how-it-works" className="py-20 px-4 border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-white mb-12">
              Start in 30 Seconds. Zero Friction.
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <span className="text-xs font-bold text-emerald-400 uppercase">Step 01</span>
                <h3 className="text-xl font-bold text-white mt-2">Text "Hi" on WhatsApp</h3>
                <p className="text-sm text-slate-400 mt-2">
                  No password to remember. No app store download. Tap the WhatsApp link or scan the QR code to begin chatting.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <span className="text-xs font-bold text-emerald-400 uppercase">Step 02</span>
                <h3 className="text-xl font-bold text-white mt-2">Connect Your Apps (Optional)</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Whenever you want Yell AI to check your emails, book meetings, or draft pitches, tap your 1-click magic link.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <span className="text-xs font-bold text-emerald-400 uppercase">Step 03</span>
                <h3 className="text-xl font-bold text-white mt-2">Automate Your Life</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Send voice notes or texts in Hinglish. Yell AI answers questions, sends emails, and alerts you proactively.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* India Pricing & Sponsor Callout */}
        <section id="pricing" className="py-20 px-4 border-t border-white/10 bg-[#0a101d]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">
                Built for Every Indian Smartphone
              </h2>
              <p className="text-slate-400 mt-3 text-sm md:text-base">
                Start free forever (supported by non-intrusive Indian brand perks), or go Pro via UPI for unlimited power.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Free Plan */}
              <div className="rounded-3xl border border-white/15 bg-slate-900/70 p-8 flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Bharat Free Tier</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">₹0</span>
                    <span className="text-sm text-slate-400">/ forever (Ad-Supported)</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-300">
                    <li>✓ 25 AI tasks & WhatsApp messages every day</li>
                    <li>✓ Connect Gmail, Google Calendar & Notion via Composio</li>
                    <li>✓ IRCTC train/flight helper, UPI budget planner & Hinglish chat</li>
                    <li>✓ Curated 1-line partner perks (Swiggy, Ixigo, CRED, Zepto)</li>
                  </ul>
                </div>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 block text-center w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition"
                >
                  Start Free on WhatsApp →
                </a>
              </div>

              {/* Pro Plan */}
              <div className="rounded-3xl border-2 border-[#25D366] bg-gradient-to-b from-emerald-950/40 to-slate-900 p-8 flex flex-col justify-between relative">
                <span className="absolute -top-3 right-6 bg-[#25D366] text-black text-xs font-extrabold px-3 py-1 rounded-full">
                  MOST POPULAR • UPI AUTOPAY
                </span>
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">Yell AI Pro</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">₹199</span>
                    <span className="text-sm text-slate-400">/ month (via UPI / Razorpay)</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-200">
                    <li>✓ <strong>1,000 AI actions/day</strong> & priority Gemini 3.8 Flash execution</li>
                    <li>✓ All 8+ Composio Connectors (Gmail, Calendar, GitHub, LinkedIn, Drive)</li>
                    <li>✓ Automated <strong>Backdoor Founder Cold-Outreach</strong> & follow-ups</li>
                    <li>✓ <strong>100% Ad-Free</strong> experience + proactive morning briefings</li>
                  </ul>
                </div>
                <Link
                  href={APP_URL}
                  className="mt-8 block text-center w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold transition shadow-lg shadow-[#25D366]/20"
                >
                  Connect Apps & Go Pro →
                </Link>
              </div>
            </div>

            {/* Direct Brand Advertiser Portal Link */}
            <div id="ads" className="mt-14 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-sky-500/10 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  ⚡ Brands & Advertisers • Intent-Driven WhatsApp Sponsorship
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  Reach Indian consumers right when they ask to travel, order food, or invest.
                </h3>
                <p className="text-sm text-slate-300 max-w-2xl">
                  Launch self-serve contextual ads in 60 seconds with prepaid Razorpay wallets, live impression tracking, and guaranteed CTR.
                </p>
              </div>
              <Link
                href="/brands"
                className="shrink-0 px-6 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-black font-bold text-sm transition shadow-lg shadow-emerald-500/20"
              >
                Launch Brand Campaign →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <section id="contact" className="py-16 px-4 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <ContactChannels />
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Yell AI by Nhancio. Built for India 🇮🇳</p>
          <div className="flex gap-6">
            <Link href={APP_URL} className="hover:text-slate-300">Yell App</Link>
            <Link href="/brands" className="hover:text-slate-300">Brands Portal</Link>
            <a href={waLink} target="_blank" rel="noreferrer" className="hover:text-slate-300">WhatsApp Bot</a>
            <a href="mailto:hello@nhancio.com" className="hover:text-slate-300">Contact & Ads</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
