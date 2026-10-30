"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../home.module.css";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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
  { id: "travel", name: "Travel & Hospitality", icon: "✈️", desc: "Flights, hotels & getaways" },
  { id: "food", name: "Dining & Quick-Commerce", icon: "🍔", desc: "Food delivery, cafes & essentials" },
  { id: "career", name: "SaaS, AI & Tech Hiring", icon: "🚀", desc: "Developer tools, SaaS & startup roles" },
  { id: "finance", name: "FinTech & Wealth", icon: "💸", desc: "Cards, payments & personal finance" },
  { id: "shopping", name: "Consumer & D2C Brands", icon: "🛍️", desc: "D2C, electronics & lifestyle" },
  { id: "general", name: "Universal / General", icon: "🌐", desc: "All high-intent conversational turns" },
];

const INTENTS = [
  { id: "railway/flight", label: "✈️ Flights, Hotels & Travel Planning", category: "travel" },
  { id: "food_order", label: "🍔 Dining, Coffee & Quick Delivery", category: "food" },
  { id: "founder_pitch", label: "🚀 Tech, Productivity & Startup Tools", category: "career" },
  { id: "tax/upi", label: "💸 FinTech, Payments & Wealth", category: "finance" },
  { id: "all", label: "🌐 Run Across All Daily Conversational Turns", category: "general" },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

function AstraMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
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
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  border: "1px solid #cce0d4",
  borderRadius: "14px",
  padding: "11px 15px",
  color: "#22221f",
  fontSize: "14px",
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(27, 77, 49, 0.04)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#55685c",
  marginBottom: "7px",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #cce0d4",
  borderRadius: "24px",
  background: "linear-gradient(150deg, #fffefa, #f5faf7)",
  boxShadow: "inset 0 1px 2px #fff, 0 4px 14px rgba(24, 90, 57, 0.06)",
};

export default function BrandsPortal() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaignAccess, setCampaignAccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

  // Form State
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("travel");
  const [targetIntent, setTargetIntent] = useState("railway/flight");
  const [headline, setHeadline] = useState(
    "Get 20% off your next domestic flight or hotel booking when you pay via UPI!"
  );
  const [ctaText, setCtaText] = useState("Claim Offer");
  const [ctaUrl, setCtaUrl] = useState("https://tryastra.web.app/?utm_source=astra_ai");
  const [cpmInr, setCpmInr] = useState(300);
  const [budgetInr, setBudgetInr] = useState(5000);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/brands/campaigns`);
      if (!res.ok) {
        setCampaignAccess(false);
        setCampaigns([]);
        setMetrics(null);
        throw new Error(res.status === 401 || res.status === 403
          ? "Campaign management requires authorized access. Contact nithindidigam@nhancio.com to set up a campaign."
          : "Couldn’t load campaigns. Please try again.");
      }
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setMetrics(data.metrics || null);
        setCampaignAccess(true);
      }
    } catch (e) {
      setNotification({ type: "error", msg: e instanceof Error ? e.message : "Couldn’t load campaigns. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const estimatedImpressions = Math.round((budgetInr / cpmInr) * 1000);

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

      await res.json();
      setNotification({
        type: "success",
        msg: `🎉 Campaign for "${brandName}" created with ₹${budgetInr.toLocaleString("en-IN")} pre-allocated budget!`,
      });

      setBrandName("");
      fetchCampaigns();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Error creating campaign" });
    } finally {
      setSubmitting(false);
    }
  };

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
        theme: { color: "#1b7a4e" },
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
    <div className={styles.site}>
      {/* Top Header matching Landing Page */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(255, 253, 250, 0.92)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid #d8e4dc",
        }}
      >
        <div
          className={styles.container}
          style={{
            height: "76px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link
              href="/"
              style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 600, fontSize: "18px" }}
            >
              <AstraMark />
              <span>Astra AI</span>
            </Link>
            <span
              style={{
                background: "#dcf2e4",
                border: "1px solid #a3d4b5",
                color: "#195936",
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 11px",
                borderRadius: "30px",
                letterSpacing: "0.03em",
              }}
            >
              Brands & Ads Portal
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "14px" }}>
            <Link href="/" style={{ color: "#4f6256", fontWeight: 500 }}>
              ← Back to Home
            </Link>
            <a
              href="/app"
              className={`${styles.button} ${styles.darkButton} ${styles.smallButton}`}
            >
              💬 Sign in to try Astra
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.container} style={{ paddingTop: "52px", paddingBottom: "90px" }}>
        {/* Hero Headline */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#e8f4ec",
                border: "1px solid #c5dfd0",
                color: "#1f5c3a",
                borderRadius: "30px",
                padding: "5px 14px",
                fontSize: "12px",
                fontWeight: 500,
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#1b7a4e",
                }}
              />
              Contextual Intent Matching Engine Active
            </span>
            <h1 style={{ fontSize: "clamp(34px, 4.5vw, 48px)", lineHeight: 1.08, color: "#15261d" }}>
              Monetize Bharat on <span style={{ color: "#1b7a4e" }}>WhatsApp</span>
            </h1>
            <p style={{ color: "#5e6d63", fontSize: "16px", maxWidth: "640px", marginTop: "14px" }}>
              Reach high-intent Indian consumers right inside their everyday WhatsApp workflows. Zero banner
              blindness, 100% contextual intent matching, and transparent pay-as-you-go CPM.
            </p>
          </div>
        </div>

        {/* Global Performance Metrics */}
        {metrics && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
              gap: "16px",
              marginTop: "36px",
            }}
          >
            {[
              {
                label: "Total Delivered",
                value: metrics.total_impressions.toLocaleString("en-IN"),
                sub: "WhatsApp Impressions",
              },
              {
                label: "Direct Taps",
                value: metrics.total_clicks.toLocaleString("en-IN"),
                sub: "Verified User Clicks",
              },
              {
                label: "Average CTR",
                value: `${metrics.avg_ctr_percent}%`,
                sub: "vs 0.8% Display Avg",
                highlight: true,
              },
              {
                label: "Live Campaigns",
                value: `${metrics.active_campaigns} / ${metrics.total_campaigns}`,
                sub: "Active Brand Sponsors",
              },
              {
                label: "Total Ad Spend",
                value: `₹${metrics.total_spent_inr.toLocaleString("en-IN")}`,
                sub: `₹${metrics.total_budget_inr.toLocaleString("en-IN")} Total Funded`,
              },
            ].map((m) => (
              <div key={m.label} style={{ ...cardStyle, padding: "20px 22px", borderRadius: "20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "#687a6e" }}>
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: "26px",
                    fontWeight: 600,
                    color: m.highlight ? "#1b7a4e" : "#18241d",
                    marginTop: "6px",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {m.value}
                </div>
                <div style={{ fontSize: "12px", color: "#1b7a4e", marginTop: "3px" }}>{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Notifications */}
        {notification && (
          <div
            style={{
              marginTop: "24px",
              padding: "16px 20px",
              borderRadius: "16px",
              fontSize: "14px",
              border: notification.type === "success" ? "1px solid #98c7ab" : "1px solid #e0b4b4",
              background: notification.type === "success" ? "#eaf6ee" : "#fdf2f2",
              color: notification.type === "success" ? "#175234" : "#8c2d2d",
            }}
          >
            {notification.msg}
          </div>
        )}

        {/* Main Grid: Campaign Builder + WhatsApp Live Preview */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "28px",
            marginTop: "40px",
            alignItems: "start",
          }}
        >
          {/* Left Column: Campaign Builder Form */}
          <div style={{ ...cardStyle, padding: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
              <span
                style={{
                  width: "5px",
                  height: "24px",
                  borderRadius: "4px",
                  background: "#1b7a4e",
                }}
              />
              <h2 style={{ fontSize: "26px", color: "#18241d" }}>Launch New Sponsored Placement</h2>
            </div>

            <form onSubmit={handleCreateCampaign} style={{ display: "grid", gap: "18px" }}>
              <div>
                <label style={labelStyle}>Brand / Advertiser Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Ixigo, CRED, Sarvam AI, Zepto"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Industry Category *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Target Intent Trigger *</label>
                  <select value={targetIntent} onChange={(e) => setTargetIntent(e.target.value)} style={inputStyle}>
                    {INTENTS.map((intn) => (
                      <option key={intn.id} value={intn.id}>
                        {intn.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Offer Headline (1–2 sentences) *</label>
                <textarea
                  required
                  rows={2}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Write a clear, compelling offer (e.g. Flat ₹100 OFF on orders above ₹299 + 10-min free delivery)."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>CTA Button Text *</label>
                  <input
                    type="text"
                    required
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Claim on Swiggy, Book on Ixigo"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Destination Landing URL *</label>
                  <input
                    type="url"
                    required
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://brand.com/offer"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Budget & CPM Slider */}
              <div
                style={{
                  background: "#eef7f1",
                  border: "1px solid #bddbc8",
                  borderRadius: "18px",
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#223b2c" }}>
                    Prepaid Ad Budget (Wallet)
                  </span>
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "#1b7a4e" }}>
                    ₹{budgetInr.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={50000}
                  step={1000}
                  value={budgetInr}
                  onChange={(e) => setBudgetInr(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#1b7a4e", margin: "12px 0 6px", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#5e7366" }}>
                  <span>₹1,000 (Starter)</span>
                  <span>₹10,000 (Growth)</span>
                  <span>₹50,000 (Scale)</span>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    paddingTop: "12px",
                    borderTop: "1px solid #cce3d4",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#4f6658" }}>
                    Rate: <strong style={{ color: "#18241d" }}>₹{cpmInr} CPM</strong> (₹0.30 / view)
                  </span>
                  <span style={{ color: "#1b7a4e", fontWeight: 600 }}>
                    Est. {estimatedImpressions.toLocaleString("en-IN")} WhatsApp impressions
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Advertiser Email</label>
                  <input
                    type="email"
                    placeholder="ads@yourbrand.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>WhatsApp Phone (For Alerts)</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !campaignAccess}
                className={`${styles.button} ${styles.darkButton}`}
                style={{ width: "100%", height: "50px", marginTop: "6px" }}
              >
                {submitting
                  ? "Creating Campaign..."
                  : `🚀 Create & Fund Campaign (₹${budgetInr.toLocaleString("en-IN")})`}
              </button>
            </form>
          </div>

          {/* Right Column: Live WhatsApp Bubble Mockup matching Landing Page Phone */}
          <div style={{ ...cardStyle, padding: "28px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "18px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", color: "#55685c" }}>
                Live WhatsApp Message Preview
              </span>
              <span
                style={{
                  background: "#dcf2e4",
                  border: "1px solid #a3d4b5",
                  color: "#195936",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "20px",
                }}
              >
                Real Rendering
              </span>
            </div>

            {/* Warm Light-Mode WhatsApp Conversation Box matching Landing Page */}
            <div
              style={{
                background: "#fffdfa",
                border: "1px solid #d5e3da",
                borderRadius: "20px",
                padding: "20px",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Outgoing User Prompt */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    background: "#23784f",
                    color: "#ffffff",
                    fontSize: "13px",
                    lineHeight: 1.45,
                    padding: "10px 14px",
                    borderRadius: "18px 18px 4px 18px",
                    maxWidth: "85%",
                  }}
                >
                  {category === "travel" && "Find the best morning flights to Bengaluru tomorrow and block my calendar"}
                  {category === "food" && "Order some quick midnight snacks from Blinkit or Swiggy"}
                  {category === "career" && "Find top funded AI startups in Bengaluru hiring engineers"}
                  {category === "finance" && "How do I save tax under new tax regime 2026?"}
                  {(category === "shopping" || category === "general") &&
                    "Can you help me buy fresh groceries in 10 mins?"}
                </div>
              </div>

              {/* Incoming Astra Reply with Sponsored Native Placement */}
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "#f1f6f3",
                    border: "1px solid #d8e8de",
                    color: "#22221f",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    padding: "12px 15px",
                    borderRadius: "18px 18px 18px 4px",
                    maxWidth: "94%",
                  }}
                >
                  <p style={{ margin: 0 }}>
                    Here is the verified information you requested! Everything is confirmed and ready for your action.
                  </p>

                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "10px",
                      borderTop: "1px solid #cde0d4",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#1b7a4e", marginBottom: "4px" }}>
                      ⚡ Sponsored • {brandName || "Your Brand"}
                    </div>
                    <p style={{ margin: "0 0 6px", color: "#3b4a40" }}>
                      {headline || "Your compelling ad headline will appear right here."}
                    </p>
                    <div style={{ color: "#155e3b", fontWeight: 600, textDecoration: "underline" }}>
                      👉 {ctaText || "Claim Offer"}: https://tryastra.web.app/r/101
                    </div>
                  </div>

                  <div style={{ fontSize: "10px", color: "#7a8a80", textAlign: "right", marginTop: "6px" }}>
                    12:45 PM • Read
                  </div>
                </div>
              </div>
            </div>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "20px 0 0",
                display: "grid",
                gap: "10px",
                fontSize: "13px",
                color: "#55685c",
              }}
            >
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1b7a4e" }} />
                Only served to free-tier users after answering their question.
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1b7a4e" }} />
                Auto-debits wallet on each delivered turn. Pauses automatically when ₹0.
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1b7a4e" }} />
                Unique tracking link redirects to your landing page & logs verified CTR.
              </li>
            </ul>
          </div>
        </div>

        {/* Live Brand Campaigns & Analytics Table */}
        <div style={{ ...cardStyle, padding: "32px", marginTop: "40px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              marginBottom: "24px",
            }}
          >
            <div>
              <h2 style={{ fontSize: "26px", color: "#18241d" }}>Live Brand Campaigns & Analytics</h2>
              <p style={{ fontSize: "13px", color: "#687a6e", marginTop: "4px" }}>
                Monitor real-time impressions, click-through rates, and wallet balances.
              </p>
            </div>
            <button
              onClick={fetchCampaigns}
              className={`${styles.button} ${styles.lightButton} ${styles.smallButton}`}
            >
              ↻ Refresh Analytics
            </button>
          </div>

          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#687a6e" }}>Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "#687a6e" }}>
              No campaigns found. Create your first campaign above!
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #cce0d4",
                      color: "#55685c",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ paddingBottom: "12px" }}>Brand & Category</th>
                    <th style={{ paddingBottom: "12px" }}>Target Intent</th>
                    <th style={{ paddingBottom: "12px" }}>Wallet Balance</th>
                    <th style={{ paddingBottom: "12px" }}>Impressions</th>
                    <th style={{ paddingBottom: "12px" }}>Clicks</th>
                    <th style={{ paddingBottom: "12px" }}>CTR</th>
                    <th style={{ paddingBottom: "12px", textAlign: "center" }}>Status</th>
                    <th style={{ paddingBottom: "12px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const budget = c.budget_inr || 0;
                    const spent = c.spent_inr || 0;
                    const percentSpent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid #e2eee7" }}>
                        <td style={{ padding: "16px 8px 16px 0" }}>
                          <div style={{ fontWeight: 600, color: "#18241d", fontSize: "14px" }}>{c.brand_name}</div>
                          <div style={{ fontSize: "11px", color: "#687a6e", textTransform: "capitalize" }}>
                            {c.category} • ₹{c.cpm_inr} CPM
                          </div>
                        </td>
                        <td style={{ padding: "16px 8px" }}>
                          <span
                            style={{
                              background: "#e8f4ec",
                              border: "1px solid #c5dfd0",
                              color: "#1f5c3a",
                              padding: "3px 9px",
                              borderRadius: "20px",
                              fontSize: "11px",
                              fontWeight: 500,
                            }}
                          >
                            {c.target_intent}
                          </span>
                        </td>
                        <td style={{ padding: "16px 8px", minWidth: "150px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "5px" }}>
                            <span style={{ color: "#223b2c", fontWeight: 600 }}>₹{spent.toLocaleString("en-IN")}</span>
                            <span style={{ color: "#687a6e" }}>/ ₹{budget.toLocaleString("en-IN")}</span>
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: "6px",
                              background: "#dfeee5",
                              borderRadius: "99px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${percentSpent}%`,
                                height: "100%",
                                background: percentSpent >= 90 ? "#c94a4a" : "#1b7a4e",
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: "16px 8px", fontWeight: 600, color: "#18241d" }}>
                          {c.impressions.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "16px 8px", fontWeight: 600, color: "#1b7a4e" }}>
                          {c.clicks.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "16px 8px", fontWeight: 700, color: "#155e3b" }}>{c.ctr_percent}%</td>
                        <td style={{ padding: "16px 8px", textAlign: "center" }}>
                          <button
                            onClick={() => handleToggle(c.id)}
                            style={{
                              padding: "4px 11px",
                              borderRadius: "20px",
                              fontSize: "11px",
                              fontWeight: 600,
                              border: c.is_active ? "1px solid #98c7ab" : "1px solid #e0b4b4",
                              background: c.is_active ? "#dcf2e4" : "#fbeaea",
                              color: c.is_active ? "#195936" : "#8c2d2d",
                            }}
                          >
                            {c.is_active ? "🟢 LIVE" : "⏸️ PAUSED"}
                          </button>
                        </td>
                        <td style={{ padding: "16px 0 16px 8px", textAlign: "right" }}>
                          <button
                            onClick={() => handleTopUp(c, 5000)}
                            disabled={payingId === c.id}
                            className={`${styles.button} ${styles.darkButton} ${styles.smallButton}`}
                            style={{ height: "34px", minWidth: "96px", padding: "0 14px", fontSize: "12px" }}
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
      </main>

      {/* Footer matching Landing Page */}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerMeta}`} style={{ marginTop: 0, paddingBottom: "36px" }}>
          <span>© {new Date().getFullYear()} Astra AI Ads Engine • Powered by Nhancio</span>
          <span>Real-time Conversational Intent Placement</span>
        </div>
      </footer>
    </div>
  );
}
