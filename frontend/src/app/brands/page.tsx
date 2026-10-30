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

const SHOWCASE_CAMPAIGNS: Campaign[] = [
  {
    id: 1,
    brand_name: "Skyscanner & MakeMyTrip",
    category: "travel",
    target_intent: "railway/flight",
    headline: "Flat ₹1,200 OFF on domestic flights & boutique stays when you book via UPI!",
    cta_text: "Use code ASTRAFLY",
    cta_url: "https://www.makemytrip.com/?utm_source=astra_ai_whatsapp",
    cpm_inr: 320,
    budget_inr: 5000,
    spent_inr: 1280,
    remaining_inr: 3720,
    impressions: 4000,
    clicks: 168,
    ctr_percent: 4.2,
    is_active: true,
  },
  {
    id: 2,
    brand_name: "Swiggy Instamart / Bolt",
    category: "food",
    target_intent: "food_order",
    headline: "Craving midnight chai or snacks? Get ₹100 OFF + Free 10-min delivery on orders above ₹299.",
    cta_text: "Claim on Swiggy",
    cta_url: "https://www.swiggy.com/?utm_source=astra_ai_whatsapp",
    cpm_inr: 280,
    budget_inr: 5000,
    spent_inr: 1540,
    remaining_inr: 3460,
    impressions: 5500,
    clicks: 242,
    ctr_percent: 4.4,
    is_active: true,
  },
  {
    id: 3,
    brand_name: "CRED / Fi Money",
    category: "finance",
    target_intent: "tax/upi",
    headline: "Pay your credit card bills or track UPI spends & earn guaranteed cashback up to ₹250.",
    cta_text: "Check Reward on CRED",
    cta_url: "https://cred.club/?utm_source=astra_ai_whatsapp",
    cpm_inr: 450,
    budget_inr: 5000,
    spent_inr: 1350,
    remaining_inr: 3650,
    impressions: 3000,
    clicks: 114,
    ctr_percent: 3.8,
    is_active: true,
  },
];

function computeMetrics(list: Campaign[]): Metrics {
  const totalImpressions = list.reduce((acc, c) => acc + c.impressions, 0);
  const totalClicks = list.reduce((acc, c) => acc + c.clicks, 0);
  const totalBudget = list.reduce((acc, c) => acc + (c.budget_inr || 0), 0);
  const totalSpent = list.reduce((acc, c) => acc + (c.spent_inr || 0), 0);
  return {
    total_campaigns: list.length,
    active_campaigns: list.filter((c) => c.is_active).length,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    avg_ctr_percent: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
    total_budget_inr: totalBudget,
    total_spent_inr: totalSpent,
  };
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
  borderRadius: "10px",
  padding: "7px 11px",
  color: "#22221f",
  fontSize: "13px",
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(27, 77, 49, 0.04)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#55685c",
  marginBottom: "4px",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #cce0d4",
  borderRadius: "14px",
  background: "linear-gradient(150deg, #fffefa, #f5faf7)",
  boxShadow: "inset 0 1px 2px #fff, 0 4px 14px rgba(24, 90, 57, 0.06)",
};

export default function BrandsPortal() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(SHOWCASE_CAMPAIGNS);
  const [metrics, setMetrics] = useState<Metrics | null>(() => computeMetrics(SHOWCASE_CAMPAIGNS));
  const [loading, setLoading] = useState(false);
  const [campaignAccess, setCampaignAccess] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("travel");
  const [targetIntent, setTargetIntent] = useState("railway/flight");
  const [headline, setHeadline] = useState(
    "Get 20% off your next domestic flight or hotel booking when you pay via UPI!"
  );
  const [ctaText, setCtaText] = useState("Claim Offer");
  const [ctaUrl, setCtaUrl] = useState("https://tryastra.web.app/?utm_source=astra_ai");
  const [cpmInr] = useState(300);
  const [budgetInr, setBudgetInr] = useState(5000);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchCampaigns = async (keyToUse?: string, explicitAttempt = false) => {
    const activeKey = (keyToUse ?? adminKey).trim();
    if (!activeKey) {
      setCampaignAccess(false);
      setCampaigns(SHOWCASE_CAMPAIGNS);
      setMetrics(computeMetrics(SHOWCASE_CAMPAIGNS));
      if (explicitAttempt) {
        setNotification({
          type: "error",
          msg: "Enter your Admin API Key to unlock live campaign management, or submit the form above to request a placement.",
        });
      }
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/brands/campaigns`, {
        headers: { "X-Admin-Key": activeKey },
      });
      if (!res.ok) {
        setCampaignAccess(false);
        sessionStorage.removeItem("astra_admin_key");
        throw new Error(
          res.status === 401 || res.status === 403
            ? "Invalid Admin API Key. Contact nithindidigam@nhancio.com for authorized campaign management."
            : "Couldn’t load live campaigns. Please try again."
        );
      }
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setMetrics(data.metrics || null);
      setCampaignAccess(true);
      sessionStorage.setItem("astra_admin_key", activeKey);
      if (explicitAttempt) {
        setNotification({ type: "success", msg: "✅ Admin access unlocked. Live campaign controls are active." });
      }
    } catch (e) {
      if (explicitAttempt) {
        setNotification({
          type: "error",
          msg: e instanceof Error ? e.message : "Couldn’t load campaigns. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedKey = typeof window !== "undefined" ? sessionStorage.getItem("astra_admin_key") || "" : "";
    if (savedKey) {
      setAdminKey(savedKey);
      fetchCampaigns(savedKey, false);
    }
  }, []);

  const estimatedImpressions = Math.round((budgetInr / cpmInr) * 1000);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName || !headline || !ctaText || !ctaUrl) {
      setNotification({ type: "error", msg: "Please fill in all required campaign fields." });
      return;
    }

    if (!campaignAccess || !adminKey.trim()) {
      const subject = encodeURIComponent(`Astra Sponsored Placement: ${brandName} (₹${budgetInr.toLocaleString("en-IN")})`);
      const body = encodeURIComponent(
        [
          `Brand / Advertiser: ${brandName}`,
          `Category: ${category}`,
          `Target Intent: ${targetIntent}`,
          `Headline: ${headline}`,
          `CTA Button: ${ctaText}`,
          `Destination URL: ${ctaUrl}`,
          `Planned Budget: ₹${budgetInr.toLocaleString("en-IN")} at ₹${cpmInr} CPM (~${estimatedImpressions.toLocaleString("en-IN")} impressions)`,
          `Contact Email: ${contactEmail || "Not provided"}`,
          `WhatsApp Phone: ${contactPhone || "Not provided"}`,
        ].join("\n")
      );
      window.location.href = `mailto:nithindidigam@nhancio.com?subject=${subject}&body=${body}`;
      setNotification({
        type: "success",
        msg: `🎉 Campaign brief prepared for "${brandName}"! Send the pre-filled email to nithindidigam@nhancio.com to activate your ₹${budgetInr.toLocaleString("en-IN")} placement.`,
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/brands/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
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
      fetchCampaigns(adminKey, false);
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Error creating campaign" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    if (!campaignAccess || !adminKey.trim()) {
      setNotification({
        type: "error",
        msg: "Unlock with your Admin API Key below to pause or resume live campaigns.",
      });
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/brands/campaigns/${id}/toggle`, {
        method: "PATCH",
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (res.ok) {
        fetchCampaigns(adminKey, false);
      }
    } catch (e) {
      console.error("Toggle failed:", e);
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
        <div className={`${styles.container} ${styles.brandsHeaderInner}`}>
          <div className={styles.brandsBrandGroup}>
            <Link href="/" className={styles.brandsBrandLink}>
              <AstraMark />
              <span>Astra AI</span>
            </Link>
            <span className={styles.brandsBadge}>Brands & Ads Portal</span>
          </div>

          <div className={styles.brandsHeaderActions}>
            <Link href="/" className={styles.brandsBackLink}>
              ← Back to Home
            </Link>
            <a href="/app" className={`${styles.button} ${styles.darkButton} ${styles.smallButton}`}>
              💬 Sign in to try Astra
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`${styles.container} ${styles.brandsMain}`}>
        {/* Compact Hero + Inline KPI Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: "1 1 360px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "clamp(24px, 3vw, 32px)", lineHeight: 1.1, color: "#15261d" }}>
                Monetize Bharat on <span style={{ color: "#1b7a4e" }}>WhatsApp</span>
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#e8f4ec",
                  border: "1px solid #c5dfd0",
                  color: "#1f5c3a",
                  borderRadius: "30px",
                  padding: "3px 10px",
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1b7a4e" }} />
                Intent Engine Active
              </span>
            </div>
            <p style={{ color: "#5e6d63", fontSize: "13px", marginTop: "4px" }}>
              High-intent native WhatsApp placements • Zero banner blindness • Pay-as-you-go CPM
            </p>
          </div>

          {metrics && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                { label: "Delivered", value: metrics.total_impressions.toLocaleString("en-IN") },
                { label: "Direct Taps", value: metrics.total_clicks.toLocaleString("en-IN") },
                { label: "Avg CTR", value: `${metrics.avg_ctr_percent}%`, highlight: true },
                { label: "Live", value: `${metrics.active_campaigns}/${metrics.total_campaigns}` },
                { label: "Ad Spend", value: `₹${metrics.total_spent_inr.toLocaleString("en-IN")}` },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    ...cardStyle,
                    padding: "7px 12px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "baseline",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "15px", fontWeight: 700, color: m.highlight ? "#1b7a4e" : "#18241d" }}>
                    {m.value}
                  </span>
                  <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#687a6e" }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        {notification && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px 14px",
              borderRadius: "12px",
              fontSize: "13px",
              border: notification.type === "success" ? "1px solid #98c7ab" : "1px solid #e0b4b4",
              background: notification.type === "success" ? "#eaf6ee" : "#fdf2f2",
              color: notification.type === "success" ? "#175234" : "#8c2d2d",
            }}
          >
            {notification.msg}
          </div>
        )}

        {/* Main Grid: Campaign Builder (Left) + Preview & Campaigns Table (Right) */}
        <div className={styles.brandsMainGrid}>
          {/* Left Column: Campaign Builder Form */}
          <div className={styles.brandsCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span
                style={{
                  width: "4px",
                  height: "18px",
                  borderRadius: "4px",
                  background: "#1b7a4e",
                  flexShrink: 0,
                }}
              />
              <h2 style={{ fontSize: "19px", color: "#18241d" }}>
                Launch New Sponsored Placement
              </h2>
            </div>

            <form onSubmit={handleCreateCampaign} style={{ display: "grid", gap: "10px" }}>
              <div className={styles.brandsFormRow}>
                <div>
                  <label style={labelStyle}>Brand / Advertiser Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swiggy, Ixigo, CRED, Zepto"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    style={inputStyle}
                  />
                </div>

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
              </div>

              <div className={styles.brandsFormRow}>
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

                <div>
                  <label style={labelStyle}>CTA Button Text *</label>
                  <input
                    type="text"
                    required
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Claim Offer"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Offer Headline (1–2 sentences) *</label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Write a clear, compelling offer (e.g. Flat ₹100 OFF + 10-min free delivery)."
                  style={inputStyle}
                />
              </div>

              <div className={styles.brandsFormRow}>
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
                <div>
                  <label style={labelStyle}>Advertiser Email & WhatsApp</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input
                      type="email"
                      placeholder="ads@brand.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="tel"
                      placeholder="+91 98765..."
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Budget & CPM Slider */}
              <div
                style={{
                  background: "#eef7f1",
                  border: "1px solid #bddbc8",
                  borderRadius: "12px",
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#223b2c" }}>
                    Prepaid Ad Budget (Wallet)
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#1b7a4e" }}>
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
                  style={{ width: "100%", accentColor: "#1b7a4e", margin: "6px 0 2px", cursor: "pointer" }}
                />
                <div className={styles.brandsRateRow}>
                  <span style={{ color: "#4f6658" }}>
                    Rate: <strong style={{ color: "#18241d" }}>₹{cpmInr} CPM</strong> (₹0.30/view)
                  </span>
                  <span style={{ color: "#1b7a4e", fontWeight: 600 }}>
                    Est. {estimatedImpressions.toLocaleString("en-IN")} impressions
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`${styles.button} ${styles.darkButton}`}
                style={{ width: "100%", height: "40px", fontSize: "13px" }}
              >
                {submitting
                  ? "Creating Campaign..."
                  : campaignAccess
                    ? `🚀 Create & Fund Campaign (₹${budgetInr.toLocaleString("en-IN")})`
                    : `🚀 Request & Launch Placement (₹${budgetInr.toLocaleString("en-IN")})`}
              </button>
            </form>
          </div>

          {/* Right Column: Live WhatsApp Preview + Live Campaigns Table Stacked */}
          <div style={{ display: "grid", gap: "14px" }}>
            <div className={styles.brandsCard}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "#55685c" }}>
                  Live WhatsApp Message Preview
                </span>
                <span
                  style={{
                    background: "#dcf2e4",
                    border: "1px solid #a3d4b5",
                    color: "#195936",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "20px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Real Rendering
                </span>
              </div>

              <div
                style={{
                  background: "#fffdfa",
                  border: "1px solid #d5e3da",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      background: "#23784f",
                      color: "#ffffff",
                      fontSize: "12px",
                      lineHeight: 1.35,
                      padding: "7px 11px",
                      borderRadius: "14px 14px 3px 14px",
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

                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      background: "#f1f6f3",
                      border: "1px solid #d8e8de",
                      color: "#22221f",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      padding: "9px 12px",
                      borderRadius: "14px 14px 14px 3px",
                      maxWidth: "96%",
                      wordBreak: "break-word",
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      Here is the verified information you requested! Everything is confirmed and ready.
                    </p>

                    <div
                      style={{
                        marginTop: "7px",
                        paddingTop: "6px",
                        borderTop: "1px solid #cde0d4",
                        fontSize: "11.5px",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#1b7a4e", marginBottom: "2px" }}>
                        ⚡ Sponsored • {brandName || "Your Brand"}
                      </div>
                      <p style={{ margin: "0 0 3px", color: "#3b4a40" }}>
                        {headline || "Your compelling ad headline will appear right here."}
                      </p>
                      <div style={{ color: "#155e3b", fontWeight: 600, textDecoration: "underline" }}>
                        👉 {ctaText || "Claim Offer"}: https://tryastra.web.app/r/101
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Live Brand Campaigns & Analytics Table */}
            <div className={styles.brandsCard}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "16px", color: "#18241d" }}>
                    Live Brand Campaigns & Analytics
                  </h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="password"
                    aria-label="Admin API Key"
                    placeholder="Admin API Key"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    style={{ ...inputStyle, width: "130px", height: "30px", padding: "0 9px", fontSize: "11px" }}
                  />
                  <button
                    type="button"
                    onClick={() => fetchCampaigns(adminKey, true)}
                    className={`${styles.button} ${styles.lightButton} ${styles.smallButton}`}
                    style={{ height: "30px", padding: "0 10px", fontSize: "11px" }}
                  >
                    {campaignAccess ? "↻ Refresh" : "🔑 Unlock"}
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{ padding: "16px 0", textAlign: "center", color: "#687a6e", fontSize: "12px" }}>
                  Loading campaigns...
                </div>
              ) : campaigns.length === 0 ? (
                <div style={{ padding: "16px 0", textAlign: "center", color: "#687a6e", fontSize: "12px" }}>
                  No campaigns found.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid #cce0d4",
                          color: "#55685c",
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <th style={{ paddingBottom: "6px" }}>Brand</th>
                        <th style={{ paddingBottom: "6px" }}>Spend / Budget</th>
                        <th style={{ paddingBottom: "6px" }}>Views</th>
                        <th style={{ paddingBottom: "6px" }}>CTR</th>
                        <th style={{ paddingBottom: "6px", textAlign: "right" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => {
                        const budget = c.budget_inr || 0;
                        const spent = c.spent_inr || 0;
                        return (
                          <tr key={c.id} style={{ borderBottom: "1px solid #e2eee7" }}>
                            <td style={{ padding: "7px 6px 7px 0" }}>
                              <div style={{ fontWeight: 600, color: "#18241d", fontSize: "12px" }}>{c.brand_name}</div>
                              <div style={{ fontSize: "10px", color: "#687a6e", textTransform: "capitalize" }}>
                                {c.category} • ₹{c.cpm_inr} CPM
                              </div>
                            </td>
                            <td style={{ padding: "7px 6px", fontSize: "11px" }}>
                              <span style={{ color: "#223b2c", fontWeight: 600 }}>₹{spent.toLocaleString("en-IN")}</span>
                              <span style={{ color: "#687a6e" }}> / ₹{budget.toLocaleString("en-IN")}</span>
                            </td>
                            <td style={{ padding: "7px 6px", fontWeight: 600, color: "#18241d" }}>
                              {c.impressions.toLocaleString("en-IN")}
                            </td>
                            <td style={{ padding: "7px 6px", fontWeight: 700, color: "#155e3b" }}>{c.ctr_percent}%</td>
                            <td style={{ padding: "7px 0 7px 6px", textAlign: "right" }}>
                              <button
                                type="button"
                                onClick={() => handleToggle(c.id)}
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: "20px",
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  border: c.is_active ? "1px solid #98c7ab" : "1px solid #e0b4b4",
                                  background: c.is_active ? "#dcf2e4" : "#fbeaea",
                                  color: c.is_active ? "#195936" : "#8c2d2d",
                                }}
                              >
                                {c.is_active ? "🟢 LIVE" : "⏸️ PAUSED"}
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
        </div>
      </main>

      {/* Compact Footer */}
      <footer style={{ borderTop: "1px solid #dce8e0", padding: "12px 0" }}>
        <div
          className={styles.container}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#687a6e" }}
        >
          <span>© {new Date().getFullYear()} Astra AI Ads Engine • Powered by Nhancio</span>
          <span>Real-time Conversational Intent Placement</span>
        </div>
      </footer>
    </div>
  );
}
