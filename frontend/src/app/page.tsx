"use client";

import Link from "next/link";
import { useState } from "react";

const WHATSAPP_NUMBER = "12057820175";
const APP_URL = "https://yellapp.nhancio.com";

const INDIA_USE_CASES = [
  {
    tag: "Poke for India • Executive Assistant",
    title: "Inbox, Calendar & Reminders in Hinglish",
    prompt: "Bhai, kal subah 11 baje Rahul ke saath Google Meet lagao aur uska last mail summarize karo.",
    reply: "✅ Done! Google Calendar invite sent to rahul@startup.in for 11:00 AM IST tomorrow.\n\n📧 *Last Email Summary:* Rahul shared the Q4 deck and asked for final pricing approval before Friday.",
    connectors: ["Gmail", "Google Calendar"],
  },
  {
    tag: "Backdoor • Direct Founder Hiring",
    title: "Skip Job Portals. DM Startup Founders Directly.",
    prompt: "Find top funded AI startups in Bengaluru hiring full-stack engineers and draft a cold email from my GitHub.",
    reply: "🚀 Found 3 newly funded BLR startups (Sarvam, Composio, Smallest AI).\n\nDrafted a custom 4-line cold email referencing your top GitHub repo. Reply *SEND* to mail the CTO directly from your Gmail!",
    connectors: ["GitHub", "Gmail", "LinkedIn"],
  },
  {
    tag: "Instinct • India Life-OS",
    title: "IRCTC Trains, Flights, Swiggy & UPI Budgets",
    prompt: "Check my IRCTC PNR from Gmail and tell me my total Swiggy + Blinkit spend this month.",
    reply: "🚆 *Train 12951 Rajdhani:* Confirmed! Coach B4, Berth 21 (Departs 17:00 IST).\n\n💸 *Monthly Food & Quick-Commerce:* ₹6,420 across 14 Swiggy & Blinkit receipts in Gmail.",
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
  const [phone, setPhone] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const cleanPhone = phone.replace(/\D/g, "");
  const fullPhone = cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone;
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Yell AI! Let's connect my apps 🇮🇳")}`;
  const connectUrl = APP_URL;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Announcement Banner */}
      <div className="bg-gradient-to-r from-orange-500/20 via-emerald-500/20 to-sky-500/20 border-b border-white/10 px-4 py-2 text-center text-xs md:text-sm text-slate-200">
        🇮🇳 <span className="font-semibold text-emerald-400">Built for Bharat:</span> Connect Gmail, Calendar, Notion & GitHub once — do everything inside WhatsApp. <Link href={APP_URL} className="underline font-medium ml-1 text-white hover:text-emerald-300">Open Yell App →</Link>
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
            <a href="#ads" className="hover:text-emerald-400 transition">Advertise with Us</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={APP_URL}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium transition"
            >
              🔌 Open Yell App
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold px-4 py-2 rounded-xl text-sm shadow-lg shadow-[#25D366]/25 transition"
            >
              <span>💬 Open in WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section (Instinct / Poke Style) */}
        <section className="relative overflow-hidden pt-14 pb-20 md:pt-24 md:pb-28 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm text-slate-300 mb-6">
              <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
              No new app to download. Lives 100% inside your WhatsApp.
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
              Your Entire Digital Life.
              <span className="block mt-2 bg-gradient-to-r from-[#25D366] via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                Inside WhatsApp. 🇮🇳
              </span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Connect your Gmail, Calendar, Notion, GitHub & LinkedIn <strong className="text-slate-200">once</strong>. Yell AI reads your emails, books meetings, cold-emails startup founders, tracks IRCTC trains & UPI spends — right from a single WhatsApp chat.
            </p>

            {/* Instant Phone Input + Launch CTA */}
            <div className="mt-10 max-w-xl mx-auto bg-slate-900/90 border border-white/15 p-2.5 rounded-2xl shadow-2xl flex flex-col sm:flex-row gap-2.5">
              <div className="flex items-center bg-black/50 border border-white/10 rounded-xl px-3.5 py-3 flex-1">
                <span className="text-slate-400 font-semibold text-sm mr-2 select-none">🇮🇳 +91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  maxLength={10}
                  className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full text-base font-medium"
                />
              </div>
              <Link
                href={connectUrl}
                className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-6 py-3.5 rounded-xl text-base transition flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-[#25D366]/20"
              >
                <span>Connect Once & Start →</span>
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span>⚡ Powered by Composio OAuth</span>
              <span>•</span>
              <span>🗣️ Speaks English, Hinglish & Hindi</span>
              <span>•</span>
              <span>🔒 Revoke access anytime in 1 tap</span>
            </div>
          </div>

          {/* Interactive WhatsApp Preview Showcase */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {INDIA_USE_CASES.map((uc, idx) => (
                <button
                  key={uc.title}
                  onClick={() => setActiveTab(idx)}
                  className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition border ${
                    activeTab === idx
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20"
                      : "bg-slate-900/80 text-slate-300 border-white/10 hover:border-white/25"
                  }`}
                >
                  {uc.tag}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/90 to-[#0b1320] p-6 md:p-8 shadow-2xl grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-5 text-left space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  {INDIA_USE_CASES[activeTab].tag}
                </span>
                <h3 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                  {INDIA_USE_CASES[activeTab].title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Zero context switching. Yell AI authenticates via Composio once and executes actions across your connected apps whenever you text.
                </p>
                <div className="pt-2">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                    Active Connectors Used:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {INDIA_USE_CASES[activeTab].connectors.map((c) => (
                      <span
                        key={c}
                        className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                      >
                        ✓ {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulated WhatsApp Chat UI */}
              <div className="md:col-span-7 bg-[#0b141a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#25D366] text-black font-extrabold flex items-center justify-center">
                      Y
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                        Yell AI <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Verified Agent</span>
                      </p>
                      <p className="text-[11px] text-emerald-400">online • connected via Composio</p>
                    </div>
                  </div>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 px-3 py-1 rounded-lg font-medium hover:bg-[#25D366]/30 transition"
                  >
                    Try Live →
                  </a>
                </div>

                <div className="p-5 space-y-4 text-left font-sans text-sm">
                  {/* User bubble */}
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow">
                      <p>{INDIA_USE_CASES[activeTab].prompt}</p>
                      <p className="text-[10px] text-emerald-200/70 text-right mt-1">10:42 AM ✓✓</p>
                    </div>
                  </div>

                  {/* Agent bubble */}
                  <div className="flex justify-start">
                    <div className="bg-[#202c33] text-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] shadow space-y-2 whitespace-pre-line">
                      <p>{INDIA_USE_CASES[activeTab].reply}</p>
                      <div className="pt-2 border-t border-white/10 text-[11px] text-amber-300/90">
                        ⚡ <span className="font-semibold">Sponsored • Ixigo Trains:</span> Zero PG charges on UPI train bookings! Use code YELLZERO.
                      </div>
                      <p className="text-[10px] text-slate-400 text-right">10:42 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Composio 1-Tap Connectors Grid */}
        <section id="connectors" className="py-20 px-4 border-t border-white/10 bg-[#0a101d]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Powered by Composio
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2">
                Connect Once. Execute Forever in WhatsApp.
              </h2>
              <p className="text-slate-400 mt-3 text-sm md:text-base">
                No complex API keys or Docker setups. Tap once to authorize your apps with bank-grade OAuth2, and Yell AI handles the rest inside chat.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CONNECTORS.map((item) => (
                <Link
                  key={item.slug}
                  href={APP_URL}
                  className="group rounded-2xl border border-white/10 bg-slate-900/60 hover:bg-slate-900 hover:border-emerald-500/40 p-5 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full group-hover:bg-emerald-500 group-hover:text-black transition">
                        1-Tap Connect →
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{item.name}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* How it works in 3 steps */}
        <section id="how-it-works" className="py-20 px-4 border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold text-center text-white mb-12">
              Live in 30 Seconds. Zero App Downloads.
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <span className="text-xs font-bold text-emerald-400 uppercase">Step 01</span>
                <h3 className="text-xl font-bold text-white mt-2">Say "Hi" on WhatsApp</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Text our verified WhatsApp number or enter your +91 mobile number above. Your phone number is your identity.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <span className="text-xs font-bold text-emerald-400 uppercase">Step 02</span>
                <h3 className="text-xl font-bold text-white mt-2">Tap Your Magic Link Once</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Approve Gmail, Google Calendar, Notion, or GitHub via Composio OAuth in 2 taps on your mobile browser.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <span className="text-xs font-bold text-emerald-400 uppercase">Step 03</span>
                <h3 className="text-xl font-bold text-white mt-2">Command Everything in Chat</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Send voice notes or Hinglish texts. Yell AI drafts replies, schedules meetings, and alerts you proactively.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* India Pricing + Ad-Supported Free Tier + Brand Sponsor Section */}
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
              {/* Free Ad-Supported Plan */}
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
                    <li>✓ <strong>1,000 AI actions/day</strong> & priority Gemini 2.0 execution</li>
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

            {/* Advertiser / Sponsor Callout */}
            <div id="ads" className="mt-14 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900 to-emerald-500/10 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  ⚡ Yell Ads Network • High-Intent WhatsApp Native Ads
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  Want to reach millions of Indian users right when they ask to book, buy, or apply?
                </h3>
                <p className="text-sm text-slate-300 max-w-2xl">
                  Place contextual 1-line native sponsor links inside Yell AI WhatsApp replies across Travel, Food Delivery, Fintech/UPI, and Tech Hiring.
                </p>
              </div>
              <a
                href="mailto:hello@nhancio.com?subject=Yell%20AI%20WhatsApp%20Ad%20Sponsorship"
                className="shrink-0 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition"
              >
                Partner / Buy Ads →
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Yell AI by Nhancio. Built for India 🇮🇳</p>
          <div className="flex gap-6">
            <Link href={APP_URL} className="hover:text-slate-300">Yell App</Link>
            <a href={waLink} target="_blank" rel="noreferrer" className="hover:text-slate-300">WhatsApp Bot</a>
            <a href="mailto:hello@nhancio.com" className="hover:text-slate-300">Contact & Ads</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
