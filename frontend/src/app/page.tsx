"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import QRCode from "qrcode";

const WHATSAPP_NUMBER = "15552107308";
const APP_URL = "https://yellapp.nhancio.com";

const RECIPES = [
  {
    id: "assistant",
    title: "Executive Assistant in Hinglish",
    badge: "Gmail & Calendar",
    icon: "📅",
    prompt: "Bhai, kal subah 11 baje Rahul ke saath Google Meet lagao aur uska last mail summarize karo.",
    reply: "✅ Done! Google Calendar invite sent to rahul@startup.in for 11:00 AM IST tomorrow.\n\n📧 Last Email Summary: Rahul shared the Q4 pitch deck and asked for final pricing approval before Friday.",
    apps: ["Gmail", "Google Calendar"],
  },
  {
    id: "hiring",
    title: "Backdoor Startup Founder Outreach",
    badge: "GitHub & LinkedIn",
    icon: "🚀",
    prompt: "Find top funded AI startups in Bengaluru hiring full-stack engineers and draft a cold email from my GitHub.",
    reply: "🚀 Found 3 funded BLR startups (Sarvam, Composio, Smallest AI).\n\nDrafted a custom 4-line cold email referencing your top repo. Reply SEND to mail the CTO directly!",
    apps: ["GitHub", "Gmail", "LinkedIn"],
  },
  {
    id: "lifeos",
    title: "India Life-OS & Expense Tracker",
    badge: "Swiggy & IRCTC",
    icon: "🚆",
    prompt: "Check my IRCTC PNR from Gmail and tell me my total Swiggy + Blinkit spend this month.",
    reply: "🚆 Train 12951 Rajdhani: Confirmed! Coach B4, Berth 21 (Departs 17:00 IST).\n\n💸 Food & Quick-Commerce: ₹6,420 across 14 Swiggy & Blinkit receipts in Gmail.",
    apps: ["Gmail", "Google Sheets"],
  },
];

const BENTO_INTEGRATIONS = [
  {
    name: "Gmail & Email",
    slug: "gmail",
    icon: "📧",
    title: "Search, summarize, and draft emails from your texts",
    description: "Read receipts, check IRCTC train confirmations, or draft replies to clients without opening your inbox.",
  },
  {
    name: "Google Calendar",
    slug: "calendar",
    icon: "📅",
    title: "Book Google Meets & manage schedule effortlessly",
    description: "Just voice-note 'Schedule a 30m call with Priya next Tuesday' — invites and Meet links are handled.",
  },
  {
    name: "Notion & Second Brain",
    slug: "notion",
    icon: "📝",
    title: "Access and organize notes & databases from WhatsApp",
    description: "Dump voice notes, meeting thoughts, or startup ideas. Yell AI structures and syncs them straight to Notion.",
  },
  {
    name: "Startup Outreach (Backdoor)",
    slug: "founder-outreach",
    icon: "🚀",
    title: "Skip job boards. DM funded startup founders directly",
    description: "Match with CTOs in Bengaluru, Gurgaon & Hyderabad. Yell AI crafts personalized cold intros referencing your GitHub.",
  },
  {
    name: "Swiggy, Blinkit & Food",
    slug: "swiggy",
    icon: "🍔",
    title: "Track monthly food expenses & order receipts",
    description: "Automatically tally Swiggy, Zomato, and Blinkit spends from your bills and keep your monthly budget in check.",
  },
  {
    name: "IRCTC & Travel",
    slug: "travel",
    icon: "🚆",
    title: "Live train PNR status, flight alerts & bookings",
    description: "Track live train delays, platform numbers, and flight boarding gates proactively before you reach the station.",
  },
];

export default function HomePage() {
  const [activeRecipe, setActiveRecipe] = useState(0);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePhone, setUpgradePhone] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Yell AI!")}`;

  const handleProUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = upgradePhone.replace(/\D/g, "");
    if (clean.length < 10) {
      alert("Please enter a valid 10-digit WhatsApp phone number.");
      return;
    }
    try {
      setUpgrading(true);
      const res = await fetch("https://yell-ai-api-6epx3aakpq-el.a.run.app/payment/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: clean }),
      });
      if (!res.ok) throw new Error("Payment link generation failed");
      const data = await res.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      }
    } catch (err: any) {
      alert(err.message || "Failed to start checkout. Try texting UPGRADE on WhatsApp!");
    } finally {
      setUpgrading(false);
    }
  };

  useEffect(() => {
    QRCode.toDataURL(waLink, {
      width: 140,
      margin: 1,
      color: { dark: "#1C1C1C", light: "#FFFFFF" },
    })
      .then(setQrUrl)
      .catch((e) => console.error("QR Error:", e));
  }, [waLink]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1C1C] flex flex-col font-sans selection:bg-[#25D366] selection:text-black antialiased">
      {/* Top Banner (Poke style pill) */}
      <div className="bg-[#F3EFEA] border-b border-[#E6E1DA] px-4 py-2 text-center text-xs text-[#5C5752] flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E5E0D8] text-[#1C1C1C] font-semibold text-[11px]">
          🇮🇳 India Beta
        </span>
        <span>Meet Yell — your proactive executive assistant on WhatsApp.</span>
        <Link href="/brands" className="font-semibold text-[#1C1C1C] underline hover:text-[#25D366] ml-1">
          Brands Portal →
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#FAF8F5]/85 border-b border-[#EAE6DE]">
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 outline-none group">
            <div className="h-8 w-8 rounded-xl bg-[#1C1C1C] text-[#FAF8F5] font-black flex items-center justify-center text-base tracking-tighter shadow-sm group-hover:scale-105 transition-transform">
              Y
            </div>
            <span className="font-bold text-xl tracking-tight text-[#1C1C1C]">Yell</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#5C5752]">
            <a href="#experience" className="hover:text-[#1C1C1C] transition-colors">Experience</a>
            <a href="#recipes" className="hover:text-[#1C1C1C] transition-colors">Recipes</a>
            <a href="#pricing" className="hover:text-[#1C1C1C] transition-colors">Pricing</a>
            <Link href="/brands" className="hover:text-[#1C1C1C] transition-colors flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
              Brands & Ads
            </Link>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-3.5">
            <Link
              href={APP_URL}
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-[#1C1C1C] hover:bg-[#EFECE6] transition-colors"
            >
              Yell App
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] text-white bg-[linear-gradient(180deg,#2D2D2D_0%,#1C1C1C_100%)] hover:bg-[#000] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.08)] h-10 rounded-xl px-5 text-sm gap-2"
            >
              <span className="h-2 w-2 rounded-full bg-[#25D366]" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-16 pb-20 md:pt-24 md:pb-32 px-6 max-w-5xl mx-auto text-center">
          {/* Top Poke Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F0ECE4] border border-[#DDD8CF] text-xs font-medium text-[#4A4540] mb-8 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
            <span>Works 100% inside your WhatsApp. No app download.</span>
          </div>

          {/* Hero Main Heading (Poke Typography) */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#141210] leading-[1.08] max-w-4xl mx-auto">
            Meet Yell, your new <br className="hidden sm:inline" />
            <span className="text-[#25D366] selection:text-white">favorite contact</span>.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-[#5C5752] max-w-2xl mx-auto leading-relaxed font-normal">
            The proactive AI assistant on WhatsApp. Texts like a human in English & Hinglish, really knows you, and integrates with your life in dozens of ways.
          </p>

          {/* Hero CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center font-bold text-base text-black bg-[#25D366] hover:bg-[#20ba59] transition-all shadow-[0_2px_10px_rgba(37,211,102,0.35)] h-13 px-8 rounded-2xl gap-2.5 active:scale-[0.98]"
            >
              <span className="text-xl">💬</span>
              <span>Say "Hi" on WhatsApp</span>
            </a>

            <Link
              href="/brands"
              className="w-full sm:w-auto inline-flex items-center justify-center font-semibold text-base text-[#1C1C1C] bg-[#EDE9E1] hover:bg-[#E4DFD5] border border-[#DDD7CE] transition-all h-13 px-7 rounded-2xl gap-2"
            >
              <span>⚡ For Brands & Advertisers →</span>
            </Link>
          </div>

          {/* Desktop QR Scan Bubble (Poke Style) */}
          {qrUrl && (
            <div className="hidden md:inline-flex items-center gap-4 mt-10 p-3 pr-6 rounded-2xl bg-[#FFFFFF] border border-[#E3DED5] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-left">
              <img src={qrUrl} alt="Scan on WhatsApp" className="w-16 h-16 rounded-xl border border-[#EEE] shadow-xs" />
              <div className="text-xs">
                <div className="font-bold text-[#1C1C1C] flex items-center gap-2">
                  <span>📱 Scan with Phone</span>
                  <span className="font-mono text-[10px] bg-[#EFECE5] text-[#555] px-1.5 py-0.5 rounded">+1 555-210-7308</span>
                </div>
                <p className="text-[#706B65] mt-0.5">Point your phone camera to start chatting instantly.</p>
              </div>
            </div>
          )}

          {/* Centered Phone Canvas Showcase (Poke Signature) */}
          <div id="experience" className="mt-16 max-w-xl mx-auto">
            <div className="relative rounded-[40px] p-3.5 bg-[#1C1C1C] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border-[4px] border-[#383838]">
              {/* iPhone Notch / Speaker Bar */}
              <div className="absolute top-7 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-[#1C1C1C] rounded-full z-20 flex items-center justify-center">
                <div className="w-10 h-1 bg-[#2C2C2C] rounded-full" />
              </div>

              {/* Screen Body */}
              <div className="bg-[#EFEAE2] rounded-[32px] overflow-hidden pt-12 pb-6 px-4 text-left font-sans">
                {/* Header inside Phone */}
                <div className="flex items-center justify-between pb-3 border-b border-[#DCD5CB] mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#25D366] text-black font-extrabold flex items-center justify-center text-xs">
                      Y
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1C1C1C] flex items-center gap-1">
                        <span>Yell AI</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
                      </div>
                      <div className="text-[10px] text-[#756F68]">online • WhatsApp Business</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#8C857D] font-mono">10:42 AM</span>
                </div>

                {/* Chat Flow */}
                <div className="space-y-3.5 text-xs">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-[#D9FDD3] text-[#111B21] rounded-2xl rounded-tr-xs px-3.5 py-2.5 max-w-[85%] shadow-xs leading-relaxed">
                      Bhai, kal 11 baje Rahul ke saath Google Meet schedule karo aur mera IRCTC PNR status bhi check karo.
                      <div className="text-[9px] text-[#667781] text-right mt-1">10:42 AM ✓✓</div>
                    </div>
                  </div>

                  {/* AI Reply */}
                  <div className="flex justify-start">
                    <div className="bg-[#FFFFFF] text-[#111B21] rounded-2xl rounded-tl-xs px-3.5 py-2.5 max-w-[90%] shadow-xs space-y-2">
                      <p className="leading-relaxed">
                        ✅ <strong>Done boss!</strong> Google Calendar invite sent to rahul@startup.in for 11:00 AM IST tomorrow with Google Meet link.
                      </p>
                      <p className="leading-relaxed">
                        🚆 <strong>Train 12951 Rajdhani:</strong> Confirmed! Coach B4, Berth 21. Departs 17:00 IST from New Delhi.
                      </p>
                      
                      {/* Native Contextual Sponsor Perk */}
                      <div className="pt-2 border-t border-[#F0ECE5] text-[11px] text-[#555]">
                        <div className="font-bold text-[#008069] flex items-center gap-1 mb-0.5">
                          <span>⚡ Sponsored • Ixigo</span>
                        </div>
                        <p className="text-[#333]">Zero Payment Gateway Charges on your IRCTC train booking via UPI with code YELLZERO.</p>
                      </div>

                      <div className="text-[9px] text-[#667781] text-right mt-1">10:42 AM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Fits into your life (Poke Style Bento Grid) */}
        <section className="py-20 px-6 border-t border-[#EAE6DE] bg-[#F5F2EB]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-[#857F77]">
                (1) Ecosystem
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#141210] tracking-tight mt-2">
                Yell fits into your life, <br className="hidden sm:inline" />
                not the other way around.
              </h2>
              <p className="text-[#5C5752] mt-4 text-sm sm:text-base leading-relaxed">
                Integrate all of your everyday tools and services with a familiar interface (WhatsApp) and zero friction.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BENTO_INTEGRATIONS.map((b) => (
                <div
                  key={b.slug}
                  className="bg-[#FFFFFF] border border-[#E3DED5] rounded-3xl p-7 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group"
                >
                  <div>
                    <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">{b.icon}</div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#857F77] mb-1">
                      {b.name}
                    </div>
                    <h3 className="text-lg font-bold text-[#141210] leading-snug mb-2">
                      {b.title}
                    </h3>
                    <p className="text-xs text-[#5C5752] leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-[#F2EEE6] flex items-center justify-between text-xs font-semibold text-[#1C1C1C]">
                    <span>1-Tap Connect</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Adapts to your needs with Recipes (Poke Style) */}
        <section id="recipes" className="py-20 px-6 border-t border-[#EAE6DE] bg-[#FAF8F5]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-wider text-[#857F77]">
                (2) Capabilities
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#141210] tracking-tight mt-2">
                Adapts to your needs with Yell Recipes.
              </h2>
              <p className="text-[#5C5752] mt-4 text-sm sm:text-base">
                Set up workflows once, trigger them with simple natural speech, and never open 10 separate apps again.
              </p>
            </div>

            {/* Recipe Tabs */}
            <div className="flex justify-center gap-2 mb-8 overflow-x-auto pb-2">
              {RECIPES.map((r, idx) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRecipe(idx)}
                  className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    activeRecipe === idx
                      ? "bg-[#1C1C1C] text-white shadow-sm"
                      : "bg-[#EFECE5] text-[#555] hover:text-[#1C1C1C] border border-[#DDD7CE]"
                  }`}
                >
                  {r.icon} {r.title}
                </button>
              ))}
            </div>

            {/* Active Recipe Display */}
            <div className="bg-[#FFFFFF] border border-[#E3DED5] rounded-3xl p-8 shadow-xs max-w-3xl mx-auto">
              <div className="flex items-center justify-between pb-4 border-b border-[#F0ECE5] mb-6">
                <span className="text-xs font-bold text-[#25D366] uppercase tracking-wider">
                  {RECIPES[activeRecipe].badge}
                </span>
                <div className="flex gap-1.5">
                  {RECIPES[activeRecipe].apps.map((app) => (
                    <span key={app} className="text-[11px] bg-[#F3EFEA] text-[#555] px-2.5 py-0.5 rounded-full font-medium">
                      {app}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="bg-[#F5F2EB] p-4 rounded-2xl border border-[#E7E2D8]">
                  <div className="text-xs font-bold text-[#777] uppercase tracking-wider mb-1">You text:</div>
                  <p className="font-medium text-[#1C1C1C]">{RECIPES[activeRecipe].prompt}</p>
                </div>

                <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#25D366]/30">
                  <div className="text-xs font-bold text-[#008069] uppercase tracking-wider mb-1">Yell AI executes:</div>
                  <p className="whitespace-pre-line leading-relaxed text-[#222]">{RECIPES[activeRecipe].reply}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Simple Pricing (Poke Style) */}
        <section id="pricing" className="py-20 px-6 border-t border-[#EAE6DE] bg-[#F5F2EB]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-wider text-[#857F77]">
                (3) Simple Pricing
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-[#141210] tracking-tight mt-2">
                Choose a plan to get started.
              </h2>
              <p className="text-[#5C5752] mt-3 text-sm sm:text-base">
                Every plan gets all of Yell. Start free, then step up for unlimited headroom.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Bharat Free Tier */}
              <div className="bg-[#FFFFFF] border border-[#DDD7CE] rounded-3xl p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#7A746D]">Bharat Free</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-[#141210]">₹0</span>
                    <span className="text-xs text-[#7A746D]">/ forever (Ad-supported)</span>
                  </div>
                  <p className="text-xs text-[#5C5752] mt-2">Supported by curated 1-line perks from Swiggy, Ixigo & CRED.</p>
                  <ul className="mt-6 space-y-3 text-xs text-[#3D3A36]">
                    <li className="flex items-center gap-2">✓ 25 AI queries & tasks per day</li>
                    <li className="flex items-center gap-2">✓ Connect Gmail, Calendar, Notion & GitHub</li>
                    <li className="flex items-center gap-2">✓ IRCTC train/flight helper & Swiggy spend calculator</li>
                    <li className="flex items-center gap-2">✓ English, Hinglish & Hindi voice & text</li>
                  </ul>
                </div>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 block text-center w-full py-3.5 rounded-xl bg-[#EDE9E1] hover:bg-[#E4DFD5] text-[#1C1C1C] font-semibold text-sm transition-colors"
                >
                  Start Free on WhatsApp →
                </a>
              </div>

              {/* Pro Plan */}
              <div className="bg-[#FFFFFF] border-2 border-[#1C1C1C] rounded-3xl p-8 flex flex-col justify-between shadow-md relative">
                <span className="absolute -top-3 right-6 bg-[#1C1C1C] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  PRO • UPI AUTOPAY
                </span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#25D366]">Yell Pro</span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-[#141210]">₹99</span>
                    <span className="text-xs text-[#7A746D]">/ month (via UPI / Razorpay)</span>
                  </div>
                  <p className="text-xs text-[#5C5752] mt-2">For founders, operators, and power users who want maximum throughput.</p>
                  <ul className="mt-6 space-y-3 text-xs text-[#3D3A36]">
                    <li className="flex items-center gap-2">✓ <strong>1,000 actions/day</strong> on Gemini 3.8 Flash</li>
                    <li className="flex items-center gap-2">✓ Automated Backdoor Founder Cold-Outreach</li>
                    <li className="flex items-center gap-2">✓ <strong>100% Ad-Free</strong> experience</li>
                    <li className="flex items-center gap-2">✓ Proactive morning briefings & priority execution</li>
                  </ul>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="mt-8 block text-center w-full py-3.5 rounded-xl bg-[#1C1C1C] hover:bg-[#000] text-white font-bold text-sm transition-colors shadow-sm cursor-pointer active:scale-[0.98]"
                >
                  Upgrade to Pro (₹99) →
                </button>
              </div>
            </div>

            {/* Brands Callout Banner inside Pricing */}
            <div className="mt-10 bg-[#FFFFFF] border border-[#DDD7CE] rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#008069]">
                  For Brands & Advertisers
                </span>
                <h3 className="text-xl font-bold text-[#141210] mt-1">
                  Monetize high-intent WhatsApp queries.
                </h3>
                <p className="text-xs text-[#5C5752] mt-1 max-w-xl">
                  Reach Indian consumers with 1-line contextual perks right when they search for travel, food, jobs, or finance.
                </p>
              </div>
              <Link
                href="/brands"
                className="shrink-0 px-6 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-black font-bold text-xs transition-colors shadow-xs"
              >
                Launch Brand Campaign →
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Upgrade to Pro Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#DDD7CE] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-left">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-black font-bold text-lg cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#008069]">
                Yell AI Pro • ₹99 / Month
              </span>
            </div>

            <h3 className="text-2xl font-extrabold text-[#141210] tracking-tight">
              Upgrade Your WhatsApp
            </h3>
            <p className="text-xs text-[#5C5752] mt-1.5 leading-relaxed">
              Enter your WhatsApp number. We will open a secure Razorpay checkout for ₹99 (supports GPay, PhonePe, Paytm, Cards & UPI Autopay).
            </p>

            <form onSubmit={handleProUpgrade} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#333] mb-1.5 uppercase tracking-wider">
                  WhatsApp Phone Number *
                </label>
                <div className="flex items-center bg-white border border-[#DDD7CE] rounded-xl px-3.5 py-3 shadow-xs">
                  <span className="text-slate-400 font-semibold text-sm mr-2">🇮🇳 +91</span>
                  <input
                    type="tel"
                    required
                    placeholder="98765 43210"
                    value={upgradePhone}
                    onChange={(e) => setUpgradePhone(e.target.value)}
                    className="bg-transparent text-[#111] placeholder-slate-400 focus:outline-none w-full text-sm font-medium"
                  />
                </div>
              </div>

              <div className="bg-[#F0ECE4] p-3 rounded-xl text-xs text-[#555] space-y-1">
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <strong className="text-black">Yell AI Pro (30 Days)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <strong className="text-[#008069] font-bold">₹99.00</strong>
                </div>
                <div className="flex justify-between">
                  <span>Daily limit:</span>
                  <span className="text-black">1,000 queries/day (0 ads)</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={upgrading}
                className="w-full bg-[#25D366] hover:bg-[#20ba59] text-black font-extrabold py-3.5 rounded-xl transition-all shadow-md text-sm cursor-pointer disabled:opacity-50"
              >
                {upgrading ? "Connecting to Razorpay..." : "Pay ₹99 via UPI / Razorpay →"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer (Poke style) */}
      <footer className="border-t border-[#EAE6DE] py-10 px-6 text-xs text-[#7A746D] bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Yell AI by Nhancio. Built for India 🇮🇳</p>
          <div className="flex gap-6 font-medium text-[#5C5752]">
            <Link href={APP_URL} className="hover:text-[#1C1C1C]">Yell App</Link>
            <Link href="/brands" className="hover:text-[#1C1C1C]">Brands Portal</Link>
            <a href={waLink} target="_blank" rel="noreferrer" className="hover:text-[#1C1C1C]">WhatsApp Bot</a>
            <a href="mailto:nithindidigam@nhancio.com" className="hover:text-[#1C1C1C]">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
