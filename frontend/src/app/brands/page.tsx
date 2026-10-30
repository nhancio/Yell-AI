"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://yell-ai-api-6epx3aakpq-el.a.run.app";

interface Campaign {
  id: number;
  brand_name: string;
  category: string;
  target_intent: string;
  headline: string;
  cta_text: string;
  cta_url: string;
  cpm_inr: number;
  budget_inr: number;
  spent_inr: number;
  remaining_inr: number;
  impressions: number;
  clicks: number;
  ctr_percent: number;
  is_active: boolean;
  contact_email?: string;
  contact_phone?: string;
  created_at?: string;
}

interface Metrics {
  total_campaigns: number;
  active_campaigns: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr_percent: number;
  total_budget_inr: number;
  total_spent_inr: number;
}

const CATEGORIES = [
  { id: "travel", name: "Travel & Mobility", icon: "🚆", desc: "IRCTC, flights, cabs & hotels" },
  { id: "food", name: "Food & Quick-Commerce", icon: "🍔", desc: "Swiggy, Zomato, Blinkit, Zepto" },
  { id: "career", name: "Career & Founder Hiring", icon: "🚀", desc: "Jobs, engineering, YC founder outreach" },
  { id: "finance", name: "FinTech & UPI", icon: "💸", desc: "Credit cards, bill pay, investments" },
  { id: "shopping", name: "Shopping & E-Commerce", icon: "🛍️", desc: "D2C, electronics, fashion & groceries" },
  { id: "general", name: "Universal / General", icon: "🌐", desc: "All high-intent conversational turns" },
];

const INTENTS = [
  { id: "railway/flight", label: "🚆 IRCTC, Trains & Flight Search", category: "travel" },
  { id: "food_order", label: "🍔 Swiggy, Blinkit & Food Delivery", category: "food" },
  { id: "founder_pitch", label: "🚀 Startup Founder Hiring & Job Pitch", category: "career" },
  { id: "tax/upi", label: "💸 UPI Spends, Credit Cards & Tax", category: "finance" },
  { id: "all", label: "🌐 Run Across All Daily Conversational Turns", category: "general" },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BrandsPortal() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

  // Form State
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("travel");
  const [targetIntent, setTargetIntent] = useState("railway/flight");
  const [headline, setHeadline] = useState("Zero Payment Gateway Charges on your first IRCTC Train or Domestic Flight booking via UPI!");
  const [ctaText, setCtaText] = useState("Claim on Ixigo");
  const [ctaUrl, setCtaUrl] = useState("https://www.ixigo.com/?utm_source=astra_ai");
  const [cpmInr, setCpmInr] = useState(300);
  const [budgetInr, setBudgetInr] = useState(5000);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/brands/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setMetrics(data.metrics || null);
      }
    } catch (e) {
      console.error("Failed to load brand campaigns:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    // Load Razorpay Script dynamically
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Estimated Impressions Calculation
  const estimatedImpressions = Math.round((budgetInr / cpmInr) * 1000);

  // Handle Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName || !headline || !ctaText || !ctaUrl) {
      setNotification({ type: "error", msg: "Please fill in all required campaign fields." });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/brands/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName,
          category,
          target_intent: targetIntent,
          headline,
          cta_text: ctaText,
          cta_url: ctaUrl,
          cpm_inr: Number(cpmInr),
          budget_inr: Number(budgetInr),
          contact_email: contactEmail || undefined,
          contact_phone: contactPhone || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create campaign");
      }

      const data = await res.json();
      setNotification({
        type: "success",
        msg: `🎉 Campaign for "${brandName}" created successfully with ₹${budgetInr.toLocaleString("en-IN")} pre-allocated budget!`,
      });

      // Reset form
      setBrandName("");
      fetchCampaigns();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Error creating campaign" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle
  const handleToggle = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/brands/campaigns/${id}/toggle`, { method: "PATCH" });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  };

  // Handle Razorpay Top-Up Prepay
  const handleTopUp = async (camp: Campaign, amountInr: number = 5000) => {
    try {
      setPayingId(camp.id);
      const orderRes = await fetch(`${BACKEND_URL}/api/brands/campaigns/${camp.id}/prepay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_inr: amountInr }),
      });

      if (!orderRes.ok) {
        throw new Error("Could not initiate Razorpay order");
      }

      const orderData = await orderRes.json();

      if (!window.Razorpay) {
        alert("Razorpay SDK not loaded. Please check your internet connection.");
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount_paise,
        currency: "INR",
        name: "Astra AI Ads Platform",
        description: `Top-Up Ad Wallet: ${camp.brand_name} (₹${amountInr})`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          const verifyRes = await fetch(`${BACKEND_URL}/api/brands/campaigns/${camp.id}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount_inr: amountInr,
            }),
          });
          if (verifyRes.ok) {
            setNotification({
              type: "success",
              msg: `✅ ₹${amountInr.toLocaleString("en-IN")} added to ${camp.brand_name} wallet! Campaign is live.`,
            });
            fetchCampaigns();
          } else {
            alert("Payment verification failed");
          }
        },
        prefill: {
          email: camp.contact_email || "advertiser@nhancio.com",
          contact: camp.contact_phone || "",
        },
        theme: { color: "#25D366" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err.message || "Top-up failed");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black font-sans">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-[#070b14]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#25D366] text-black font-black flex items-center justify-center text-lg">Y</div>
            <span className="font-bold text-xl text-white tracking-tight">Astra AI</span>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Brands & Ads Portal
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            ← Back to Home
          </Link>
          <a
            href="https://wa.me/15552107308?text=Hi%20Astra"
            target="_blank"
            rel="noreferrer"
            className="bg-[#25D366] text-black font-semibold px-4 py-1.5 rounded-lg hover:bg-[#20ba59] transition-all flex items-center gap-1.5 text-xs"
          >
            💬 Test on WhatsApp
          </a>
        </div>
      </header>

      {/* Hero Headline */}
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Monetize Bharat on <span className="text-[#25D366]">WhatsApp</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-1.5 max-w-2xl">
              Reach high-intent Indian consumers right inside their private WhatsApp conversations. 
              Zero banner blindness. 100% contextual intent matching. Pay-as-you-go CPM.
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-full">
              <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
              Contextual Intent Matching Engine Active
            </span>
          </div>
        </div>

        {/* Global Performance Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-8">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium uppercase">Total Delivered</div>
              <div className="text-2xl font-bold text-white mt-1">
                {metrics.total_impressions.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5">WhatsApp Impressions</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium uppercase">Direct Taps</div>
              <div className="text-2xl font-bold text-white mt-1">
                {metrics.total_clicks.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-sky-400 mt-0.5">Verified User Clicks</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium uppercase">Average CTR</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {metrics.avg_ctr_percent}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">vs 0.8% Meta Display Avg</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium uppercase">Live Campaigns</div>
              <div className="text-2xl font-bold text-white mt-1">
                {metrics.active_campaigns} <span className="text-xs font-normal text-slate-400">/ {metrics.total_campaigns}</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Active Brands</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-400 font-medium uppercase">Total Ad Spend</div>
              <div className="text-2xl font-bold text-white mt-1">
                ₹{metrics.total_spent_inr.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">₹{metrics.total_budget_inr.toLocaleString("en-IN")} Total Funded</div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {notification && (
          <div className={`mt-6 p-4 rounded-xl border text-sm ${notification.type === "success" ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200" : "bg-rose-950/60 border-rose-500/40 text-rose-200"}`}>
            {notification.msg}
          </div>
        )}

        {/* Main Grid: Campaign Builder + WhatsApp Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
          {/* Left Column: Campaign Builder Form */}
          <div className="lg:col-span-7 bg-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-6 w-1 rounded-full bg-[#25D366]" />
              <h2 className="text-xl font-bold text-white">Launch New Sponsored Placement</h2>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-5">
              {/* Brand Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                  Brand / Advertiser Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Ixigo, CRED, Sarvam AI, Zepto"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#25D366] text-sm"
                />
              </div>

              {/* Category & Target Intent Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    Industry Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#25D366]"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    Target Intent Trigger *
                  </label>
                  <select
                    value={targetIntent}
                    onChange={(e) => setTargetIntent(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#25D366]"
                  >
                    {INTENTS.map((intn) => (
                      <option key={intn.id} value={intn.id}>
                        {intn.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Headline */}
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                  Offer Headline (1–2 sentences) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Write a clear, compelling offer (e.g. Flat ₹100 OFF on orders above ₹299 + 10-min free delivery)."
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#25D366] text-sm resize-none"
                />
              </div>

              {/* CTA Text & URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    CTA Button Text *
                  </label>
                  <input
                    type="text"
                    required
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Claim on Swiggy, Book on Ixigo"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#25D366] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    Destination Landing URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://brand.com/offer"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#25D366] text-sm"
                  />
                </div>
              </div>

              {/* Budget & CPM Slider */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300 font-medium">Prepaid Ad Budget (Wallet)</span>
                  <span className="text-lg font-bold text-[#25D366]">₹{budgetInr.toLocaleString("en-IN")}</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={50000}
                  step={1000}
                  value={budgetInr}
                  onChange={(e) => setBudgetInr(Number(e.target.value))}
                  className="w-full accent-[#25D366] cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>₹1,000 (Starter)</span>
                  <span>₹10,000 (Growth)</span>
                  <span>₹50,000 (Scale)</span>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Rate: <strong className="text-white">₹{cpmInr} CPM</strong> (₹0.30 / view)</span>
                  <span className="text-emerald-400 font-semibold">
                    Est. {estimatedImpressions.toLocaleString("en-IN")} WhatsApp impressions
                  </span>
                </div>
              </div>

              {/* Contact Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    Advertiser Email
                  </label>
                  <input
                    type="email"
                    placeholder="ads@yourbrand.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#25D366] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                    WhatsApp Phone (For Alerts)
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#25D366] text-sm"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#25D366] text-black font-bold py-3.5 rounded-xl hover:bg-[#20ba59] transition-all shadow-lg shadow-emerald-500/20 text-sm disabled:opacity-50"
              >
                {submitting ? "Creating Campaign..." : `🚀 Create & Fund Campaign (₹${budgetInr.toLocaleString("en-IN")})`}
              </button>
            </form>
          </div>

          {/* Right Column: Live WhatsApp Bubble Mockup */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Live WhatsApp Message Preview
                </div>
                <div className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Real Rendering
                </div>
              </div>

              {/* Realistic WhatsApp Chat Bubble Container */}
              <div className="bg-[#0b141a] rounded-xl p-4 border border-white/5 space-y-3 font-sans">
                {/* Mock Inbound User Prompt */}
                <div className="flex justify-end">
                  <div className="bg-[#005c4b] text-[#e9edef] text-xs px-3.5 py-2 rounded-2xl rounded-tr-none max-w-[85%]">
                    {category === "travel" && "Check 12951 Rajdhani train timing and seat availability tomorrow"}
                    {category === "food" && "Order some quick midnight snacks from Blinkit or Swiggy"}
                    {category === "career" && "Find top funded AI startups in Bengaluru hiring engineers"}
                    {category === "finance" && "How do I save tax under new tax regime 2026?"}
                    {(category === "shopping" || category === "general") && "Can you help me buy fresh groceries in 10 mins?"}
                  </div>
                </div>

                {/* Mock Outbound AI Assistant Reply with Native Ad Footer */}
                <div className="flex justify-start">
                  <div className="bg-[#202c33] text-[#e9edef] text-xs px-3.5 py-2.5 rounded-2xl rounded-tl-none max-w-[95%] space-y-2">
                    <p className="leading-relaxed text-slate-200">
                      Here is the verified information you requested! Everything is confirmed and ready for your action.
                    </p>
                    
                    {/* Sponsored Native Card */}
                    <div className="pt-2 border-t border-white/10 text-[11px] leading-relaxed text-slate-300">
                      <div className="font-bold text-[#25D366] flex items-center gap-1 mb-1">
                        <span>⚡ Sponsored • {brandName || "Your Brand"}</span>
                      </div>
                      <p className="text-slate-200 mb-1.5">
                        {headline || "Your compelling ad headline will appear right here."}
                      </p>
                      <div className="text-emerald-400 underline font-medium hover:text-emerald-300 cursor-pointer">
                        👉 {ctaText || "Claim Offer"}: https://yell.nhancio.com/r/101
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 text-right mt-1">
                      12:45 PM • Read
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
                  <span>Only served to free-tier users after answering their question.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
                  <span>Auto-debits wallet on each delivered turn. Pauses when ₹0.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
                  <span>Unique tracking link redirects to your landing page & logs CTR.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Existing & Active Campaigns Table */}
        <div className="mt-12 bg-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Live Brand Campaigns & Analytics</h2>
              <p className="text-xs text-slate-400 mt-1">
                Monitor real-time impressions, click-through rates, and wallet balances.
              </p>
            </div>
            <button
              onClick={fetchCampaigns}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 transition-all"
            >
              🔄 Refresh Analytics
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No campaigns found. Create your first campaign above!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-semibold">Brand & Category</th>
                    <th className="pb-3 font-semibold">Target Intent</th>
                    <th className="pb-3 font-semibold">Wallet Balance</th>
                    <th className="pb-3 font-semibold">Impressions</th>
                    <th className="pb-3 font-semibold">Clicks</th>
                    <th className="pb-3 font-semibold">CTR</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {campaigns.map((c) => {
                    const budget = c.budget_inr || 0;
                    const spent = c.spent_inr || 0;
                    const percentSpent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                          <div className="font-bold text-white text-sm">{c.brand_name}</div>
                          <div className="text-[11px] text-slate-400 capitalize">{c.category} • ₹{c.cpm_inr} CPM</div>
                        </td>
                        <td className="py-4">
                          <span className="inline-block bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[11px] text-slate-300">
                            {c.target_intent}
                          </span>
                        </td>
                        <td className="py-4 min-w-[140px]">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-300">₹{spent.toLocaleString("en-IN")}</span>
                            <span className="text-slate-400 font-semibold">/ ₹{budget.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${percentSpent >= 90 ? "bg-rose-500" : "bg-[#25D366]"}`}
                              style={{ width: `${percentSpent}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-4 font-semibold text-white">
                          {c.impressions.toLocaleString("en-IN")}
                        </td>
                        <td className="py-4 font-semibold text-sky-400">
                          {c.clicks.toLocaleString("en-IN")}
                        </td>
                        <td className="py-4 font-bold text-emerald-400">
                          {c.ctr_percent}%
                        </td>
                        <td className="py-4 text-center">
                          <button
                            onClick={() => handleToggle(c.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-all ${
                              c.is_active
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                            }`}
                          >
                            {c.is_active ? "🟢 LIVE" : "⏸️ PAUSED"}
                          </button>
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleTopUp(c, 5000)}
                            disabled={payingId === c.id}
                            className="bg-[#25D366] text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-[#20ba59] transition-all text-xs disabled:opacity-50"
                          >
                            {payingId === c.id ? "..." : "+ ₹5,000"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 px-6 py-6 text-center text-xs text-slate-500">
        Astra AI Ads Engine • Powered by Nhancio • Real-time Conversational Intent Placement
      </footer>
    </div>
  );
}
