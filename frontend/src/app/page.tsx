"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import styles from "./home.module.css";

const APP_URL = "https://astraapp.nhancio.com";
const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "918790968218";
const whatsapp = (text = "Hi Astra!") =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
const WA_LINK = whatsapp();
const asset = (name: string) => `/poke/${name}`;
const apps = [
  ["Strava", "stravaapp.webp"],
  ["Canva", "canvaapp.webp"],
  ["Gmail", "gmailapp.webp"],
  ["Google Calendar", "googlecalendarapp.webp"],
  ["GitHub", "githubapp.webp"],
  ["Granola", "granolaapp.webp"],
  ["Asana", "asanaapp.webp"],
  ["Sonos", "sonosapp.webp"],
  ["Notion", "notionapp.webp"],
  ["Linear", "linearapp.webp"],
  ["Todoist", "todoistapp.webp"],
  ["Vercel", "vercel.png"],
  ["Ramp", "rampapp.webp"],
  ["Webflow", "webflow.png"],
  ["Devin", "devin.svg"],
  ["Mercury", "mercuryapp.webp"],
  ["Cursor", "cursor.png"],
  ["Fitbit", "fitbit.svg"],
  ["Sentry", "sentry.png"],
  ["Oura", "ourapp.webp"],
  ["Supabase", "supabase.png"],
  ["Philips Hue", "hueapp.webp"],
  ["Netlify", "netlify.png"],
  ["Outlook", "outlookapp.webp"],
];
const recipes = [
  {
    name: "Executive assistant",
    icon: "googlecalendarapp.webp",
    title: "A little less admin. A lot more life.",
    description: "Your inbox, calendar, and to-do list. All in one text.",
    prompt:
      "Bhai, kal subah 11 baje Rahul ke saath Google Meet lagao aur uska last mail summarize karo.",
  },
  {
    name: "Founder outreach",
    icon: "githubapp.webp",
    title: "Your next opportunity, one text away.",
    description: "Make the right connections, with a little help.",
    prompt:
      "Find funded AI startups in Bengaluru hiring full-stack engineers and draft an intro from my GitHub.",
  },
  {
    name: "Everyday life",
    icon: "gmailapp.webp",
    title: "All the little things, taken care of.",
    description: "Travel plans, expenses, and everything in between.",
    prompt:
      "Check my IRCTC PNR from Gmail and total my Swiggy + Blinkit spend this month.",
  },
];
const conversationIdeas = [
  [
    "A calmer morning",
    "Give me a quick morning briefing: today's meetings, important emails, and anything I should know before I head out.",
    "googlecalendarapp.webp",
  ],
  [
    "An inbox that feels lighter",
    "Summarize my unread emails and draft a reply to the ones that need my attention.",
    "gmailapp.webp",
  ],
  [
    "Room for your next big idea",
    "Save this voice note to Notion and turn it into a tidy list of next steps. I'll come back to it after lunch.",
    "notionapp.webp",
  ],
  [
    "A little help getting there",
    "Find my train booking in Gmail and remind me to leave for the station on time.",
    "gmailapp.webp",
  ],
  [
    "Your next chapter",
    "Help me write a short introduction to a startup founder using the projects on my GitHub.",
    "githubapp.webp",
  ],
  [
    "The everyday, sorted",
    "Add up this month's food and grocery receipts. How much did I spend on Swiggy and Blinkit?",
    "googlecalendarapp.webp",
  ],
];

function Icon({
  name,
  size = 20,
}: {
  name: "arrow" | "chevron" | "check" | "voice" | "plus" | "close" | "menu";
  size?: number;
}) {
  const paths = {
    arrow: "M5 12h14m-6-6 6 6-6 6",
    chevron: "m9 5 7 7-7 7",
    check: "m5 12 4 4L19 6",
    voice: "M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    menu: "M4 7h16M4 12h16M4 17h16",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function Mark({ app = false }: { app?: boolean }) {
  return (
    <span className={app ? styles.appMark : styles.mark} aria-hidden="true">
      <svg viewBox="0 0 40 44" fill="none">
        <path
          d="m7 5 13 15L33 5M20 20v18M7 39h26"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 13 20 20l14-7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function Phone() {
  return (
    <div
      className={styles.phone}
      role="img"
      aria-label="Example WhatsApp conversation with Astra AI about scheduling a meeting and checking a train booking"
    >
      <div className={styles.phoneScreen}>
        <div className={styles.statusBar}>
          <b>9:41</b>
          <span className={styles.statusIcons}>
            ▮▮▮{" "}
            <svg
              width="17"
              height="14"
              viewBox="0 0 20 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M1 5a14 14 0 0 1 18 0l-2 2A11 11 0 0 0 3 7Zm4 4a8 8 0 0 1 10 0l-2 2a5 5 0 0 0-6 0Zm3 4a3 3 0 0 1 4 0l-2 3Z" />
            </svg>
            <span className={styles.battery} />
          </span>
        </div>
        <div className={styles.contact}>
          <span className={styles.backArrow}>‹</span>
          <Mark app />
          <b>
            Astra <span className={styles.verified}>✦</span>
            <span className={styles.contactChevron}>›</span>
          </b>
        </div>
        <div className={styles.messages}>
          <span className={styles.chatDate}>Today 9:41 AM</span>
          <p className={styles.incoming}>morning! ready for the day?</p>
          <p className={styles.outgoing}>
            Bhai, schedule a Meet with Rahul for 11 tomorrow
          </p>
          <p className={styles.incoming}>
            done boss! invite sent, Meet link included
          </p>
          <p className={styles.incoming}>
            btw your Rajdhani ticket is confirmed. B4, berth 21 🚆
          </p>
          <p className={styles.outgoing}>you remembered 😭</p>
          <p className={styles.incoming}>that&apos;s what I&apos;m here for</p>
          <span className={styles.typing}>
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className={styles.messageInput}>
          <Icon name="plus" />
          <span>Message Astra</span>
          <Icon name="voice" />
        </div>
        <span className={styles.homeIndicator} />
      </div>
      <img
        src={asset("phoneframe.38o-vdzwwky7a.webp")}
        alt=""
        className={styles.phoneFrame}
        fetchPriority="high"
      />
    </div>
  );
}

export default function HomePage() {
  const [activeRecipe, setActiveRecipe] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "business">("pro");
  const [upgradePhone, setUpgradePhone] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const upgradeDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    QRCode.toDataURL(WA_LINK, {
      width: 180,
      margin: 1,
      color: { dark: "#252525", light: "#FFFFFF" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, []);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 70);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (showUpgradeModal) upgradeDialog.current?.showModal();
    else upgradeDialog.current?.close();
  }, [showUpgradeModal]);

  const handleProUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = upgradePhone.replace(/\D/g, "");
    if (clean.length < 10 || clean.length > 15) {
      setCheckoutError(
        "Enter your WhatsApp number with 10–15 digits, including your country code.",
      );
      return;
    }
    setCheckoutError("");
    setUpgrading(true);
    try {
      const res = await fetch(
        "https://yell-ai-api-6epx3aakpq-el.a.run.app/payment/create-link",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone_number: clean, plan: selectedPlan }),
        },
      );
      if (!res.ok)
        throw new Error(
          "Couldn’t start checkout. Please try again, or text UPGRADE on WhatsApp.",
        );
      const data = await res.json();
      if (!data.payment_url)
        throw new Error("No checkout link was returned. Please try again.");
      window.location.href = data.payment_url;
    } catch (err: unknown) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : "Couldn’t connect. Please try again, or text UPGRADE on WhatsApp.",
      );
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className={styles.site}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.heroWrap}>
        <img
          className={styles.heroBackground}
          src={asset("herobg.0xbmuzkojhss1.webp")}
          alt=""
          fetchPriority="high"
        />
        <header
          className={`${styles.header} ${scrolled ? styles.scrolledHeader : ""}`}
        >
          <Link href="/" aria-label="Astra home" className={styles.logo}>
            <Mark />
          </Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <details className={styles.navDropdown}>
              <summary>
                Product <span>⌄</span>
              </summary>
              <div>
                <a href="#experience">Meet Astra</a>
                <a href="#recipes">Recipes</a>
                <a href={APP_URL}>
                  Astra App <Icon name="arrow" size={14} />
                </a>
              </div>
            </details>
            <details className={styles.navDropdown}>
              <summary>
                Resources <span>⌄</span>
              </summary>
              <div>
                <a href="#faq">FAQs</a>
                <a href="#integrations">Integrations</a>
                <a href="mailto:nithindidigam@nhancio.com">Contact us</a>
              </div>
            </details>
            <a href="#pricing">Pricing</a>
            <Link href="/brands">For Brands</Link>
          </nav>
          <div className={styles.headerActions}>
            <a href={APP_URL} className={styles.login}>
              Log in
            </a>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
              className={`${styles.button} ${styles.darkButton} ${styles.smallButton}`}
            >
              Get Started
            </a>
            <button
              className={styles.mobileToggle}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
          {menuOpen && (
            <nav
              id="mobile-navigation"
              className={styles.mobileNav}
              aria-label="Mobile navigation"
              onClick={() => setMenuOpen(false)}
            >
              <a href="#experience">Meet Astra</a>
              <a href="#recipes">Recipes</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQs</a>
              <Link href="/brands">For Brands</Link>
              <a href={APP_URL}>Log in</a>
            </nav>
          )}
        </header>
        <section
          className={styles.hero}
          id="experience"
          aria-labelledby="hero-title"
        >
          <Link href="/brands" className={styles.announcement}>
            <span>New</span> Your everyday, a little easier{" "}
            <Icon name="chevron" size={14} />
          </Link>
          <h1 id="hero-title">
            Meet Astra,
            <br />
            your new favorite contact
          </h1>
          <p className={styles.heroSubtitle}>
            Proactive, personal, and right in your WhatsApp
          </p>
          <div className={styles.heroActions}>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
              className={`${styles.button} ${styles.darkButton}`}
            >
              Get Started
            </a>
            <a
              href="#recipes"
              className={`${styles.button} ${styles.lightButton}`}
            >
              Explore
            </a>
          </div>
          <div className={styles.phoneStage}>
            <Phone />
            {qrUrl && (
              <div className={styles.qrWrap}>
                <button
                  className={styles.qrTrigger}
                  onClick={() => setShowQr(!showQr)}
                  aria-expanded={showQr}
                  aria-controls="whatsapp-qr"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h3v3h-3zm4 4h3v3h-3zm3-4v2m-7 3v2M6 6h1m10 0h1M6 17h1" />
                  </svg>{" "}
                  Scan to say hi <Icon name="chevron" size={13} />
                </button>
                {showQr && (
                  <div className={styles.qrPanel} id="whatsapp-qr">
                    <img
                      src={qrUrl}
                      width="160"
                      height="160"
                      alt="Scan this QR code to chat with Astra on WhatsApp"
                    />
                    <p>
                      Open your camera.
                      <br />
                      Meet your new favorite contact.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <main id="main">
        <section
          className={styles.integrationSection}
          id="integrations"
          aria-labelledby="integration-title"
        >
          <div className={styles.container}>
            <h2 id="integration-title">
              Astra fits into your life <sup>(1)</sup>,<br />
              not the other way around
            </h2>
          </div>
          <div
            className={styles.iconMarquees}
            aria-label="Connected apps and services"
          >
            {[apps.slice(0, 12), apps.slice(12)].map((row, rowIndex) => (
              <div className={styles.iconRow} key={rowIndex}>
                <div
                  className={`${styles.iconTrack} ${rowIndex === 1 ? styles.reverseTrack : ""}`}
                >
                  {[0, 1].map((copy) => (
                    <div
                      className={styles.iconSet}
                      key={copy}
                      aria-hidden={copy === 1 ? true : undefined}
                    >
                      {row.map(([name, file]) => (
                        <img
                          src={asset(file)}
                          alt={copy === 0 ? name : ""}
                          title={copy === 0 ? name : undefined}
                          width="44"
                          height="44"
                          loading="lazy"
                          key={name}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={`${styles.container} ${styles.integrationCopy}`}>
            <span className={styles.number}>(1)</span>
            <p>
              Bring your apps and services together in a familiar interface{" "}
              <span>(WhatsApp)</span> and a personality that keeps things as
              real as a friend.
            </p>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
              className={styles.textLink}
            >
              Find your flow <Icon name="arrow" size={18} />
            </a>
          </div>
        </section>

        <div className={styles.container}>
          <section
            className={styles.featureRow}
            id="recipes"
            aria-labelledby="recipes-title"
          >
            <div className={`${styles.featureVisual} ${styles.recipeVisual}`}>
              <div className={styles.recipeStack}>
                {recipes.map((r, i) => (
                  <button
                    key={r.name}
                    className={`${styles.recipeCard} ${activeRecipe === i ? styles.activeRecipe : ""}`}
                    onClick={() => setActiveRecipe(i)}
                    aria-pressed={activeRecipe === i}
                  >
                    <div className={styles.recipeCardTitle}>
                      <img src={asset(r.icon)} alt="" width="36" height="36" />
                      <b>{r.name}</b>
                      <Icon name="plus" size={18} />
                    </div>
                    <p>{r.description}</p>
                    <span>
                      <Mark /> Astra Team{" "}
                      <span className={styles.recipeChip}>
                        Try recipe <Icon name="arrow" size={11} />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.featureCopy}>
              <span className={styles.number}>(2)</span>
              <h2 id="recipes-title">
                Adapts to your needs
                <br />
                with Astra Recipes
              </h2>
              <p>
                Set up your integrations, make everyday tasks automatic, and
                find a little more time for yourself.
              </p>
              <p className={styles.recipeTitle} aria-live="polite">
                {recipes[activeRecipe].title}
              </p>
              <a
                href={whatsapp(recipes[activeRecipe].prompt)}
                target="_blank"
                rel="noreferrer"
                className={styles.textLink}
              >
                Try this recipe <Icon name="arrow" size={18} />
              </a>
            </div>
          </section>

          <section
            className={`${styles.featureRow} ${styles.reverseFeature}`}
            aria-labelledby="schedule-title"
          >
            <div className={`${styles.featureVisual} ${styles.scheduleVisual}`}>
              <div className={styles.voiceCard}>
                <span className={styles.voiceLabel}>
                  <span className={styles.recordingDot} /> Voice message
                </span>
                <div className={styles.waveform} aria-hidden="true">
                  {Array.from({ length: 44 }, (_, i) => (
                    <i
                      key={i}
                      style={{ height: `${10 + ((i * 19 + 7) % 49)}px` }}
                    />
                  ))}
                </div>
                <div className={styles.voiceTime}>
                  <span>0:00</span>
                  <span>0:12</span>
                </div>
                <p>
                  “Remind me to call Amma
                  <br />
                  tomorrow at 6.”
                </p>
                <span className={styles.voiceReply}>
                  <Icon name="check" size={16} /> I&apos;ll remind you. Go enjoy
                  your day.
                </span>
              </div>
            </div>
            <div className={styles.featureCopy}>
              <span className={styles.number}>(3)</span>
              <h2 id="schedule-title">
                Handles tasks according
                <br />
                to your schedule
              </h2>
              <p>
                From meeting invites to reminders that actually arrive on time.
                Just send a text or a voice note, in English, Hindi, or
                Hinglish.
              </p>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
                className={styles.textLink}
              >
                Leave it with Astra <Icon name="arrow" size={18} />
              </a>
            </div>
          </section>

          <section
            className={styles.featureRow}
            aria-labelledby="proactive-title"
          >
            <div className={`${styles.featureVisual} ${styles.peopleVisual}`}>
              <div className={styles.peopleGrid}>
                {[
                  ["Rahul", "mars.jpeg"],
                  ["Priya", "claudia.webp"],
                  ["Arjun", "andrew.webp"],
                ].map(([name, photo]) => (
                  <div key={name}>
                    <img
                      src={asset(photo)}
                      alt=""
                      width="80"
                      height="80"
                      loading="lazy"
                    />
                    <span>{name}</span>
                  </div>
                ))}
                <div>
                  <Mark app />
                  <span>Astra</span>
                </div>
              </div>
              <div className={styles.notification}>
                <Mark app />
                <div>
                  <b>
                    Astra <span>now</span>
                  </b>
                  <p>
                    Your train leaves at 5. Leave a little early — traffic looks
                    busy.
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.featureCopy}>
              <span className={styles.number}>(4)</span>
              <h2 id="proactive-title">
                Proactively keeps
                <br />
                you in the loop
              </h2>
              <p>
                A heads-up before your train. A morning briefing before your
                coffee. Astra remembers the little things, and reaches out when
                it matters.
              </p>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
                className={styles.textLink}
              >
                Meet your assistant <Icon name="arrow" size={18} />
              </a>
            </div>
          </section>

          <section
            className={`${styles.featureRow} ${styles.reverseFeature}`}
            aria-labelledby="advanced-title"
          >
            <div className={`${styles.featureVisual} ${styles.buildVisual}`}>
              <div className={styles.composer}>
                <span className={styles.composerTitle}>
                  What would you like to make happen?
                </span>
                <p>Add action items from my emails to calendar</p>
                <div>
                  <span>
                    <Icon name="plus" size={14} /> Integrations
                  </span>
                  <span className={styles.createButton}>
                    Create <Icon name="arrow" size={13} />
                  </span>
                </div>
              </div>
              <div className={styles.connectedApps}>
                {[
                  "gmailapp.webp",
                  "googlecalendarapp.webp",
                  "notionapp.webp",
                ].map((f) => (
                  <img
                    key={f}
                    src={asset(f)}
                    width="48"
                    height="48"
                    alt=""
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
            <div className={styles.featureCopy}>
              <span className={styles.number}>(5)</span>
              <h2 id="advanced-title">
                A little more powerful.
                <br />A lot more personal.
              </h2>
              <p>
                Connect Gmail, Calendar, Notion, and GitHub once. Astra puts them
                to work together, right inside your WhatsApp.
              </p>
              <a href={APP_URL} className={styles.textLink}>
                Explore Astra App <Icon name="arrow" size={18} />
              </a>
            </div>
          </section>
        </div>

        <section
          id="pricing"
          className={`${styles.container} ${styles.pricing}`}
          aria-labelledby="pricing-title"
        >
          <h2 id="pricing-title">Choose a plan to get started</h2>
          <p className={styles.sectionSubtitle}>
            Every plan gets all of Astra. Start free, then step up for more
            <br className={styles.desktopBreak} /> intelligence and headroom as
            it becomes part of your day.
          </p>
          <span className={styles.billingPill}>Simple monthly pricing</span>
          <div className={styles.pricingGrid}>
            <article className={styles.plan}>
              <h3>Bharat Free</h3>
              <p>Get started and explore what Astra can do for you</p>
              <div className={styles.price}>
                ₹0<span>/ month</span>
              </div>
              <span className={styles.billingNote}>
                Free forever · Ad-supported
              </span>
              <div className={styles.planDivider} />
              <b className={styles.includes}>Includes:</b>
              <ul>
                {[
                  "15 AI tasks per day (Ad-supported)",
                  "Connect Gmail, Calendar, Notion & GitHub",
                  "IRCTC train, travel & Swiggy expense tracker",
                  "English, Hinglish & Hindi voice and text",
                ].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
                className={`${styles.button} ${styles.lightButton}`}
              >
                Start Free on WhatsApp
              </a>
            </article>

            {/* Pro Plan */}
            <article className={`${styles.plan} ${styles.proPlan}`}>
              <span className={styles.planBadge}>
                Fair Usage Policy • Most Popular
              </span>
              <h3>Astra Pro</h3>
              <p>For founders, operators, and everyday power users</p>
              <div className={styles.price}>
                ₹99<span>/ month</span>
              </div>
              <span className={styles.billingNote}>
                Billed monthly · UPI / Razorpay
              </span>
              <div className={styles.planDivider} />
              <b className={styles.includes}>Everything in Free, plus:</b>
              <ul>
                {[
                  "80 actions per day (FUP: ~2,400 tasks/mo)",
                  "Priority execution on Gemini 3.8 Flash",
                  "Founder cold outreach & custom drafts",
                  "100% Ad-Free experience",
                ].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setSelectedPlan("pro");
                  setCheckoutError("");
                  setShowUpgradeModal(true);
                }}
                className={`${styles.button} ${styles.darkButton}`}
              >
                Get Pro (₹99) <Icon name="arrow" size={17} />
              </button>
            </article>

            {/* Business / Team Plan */}
            <article className={`${styles.plan} ${styles.proPlan}`}>
              <span className={styles.planBadge}>
                Enterprise Headroom
              </span>
              <h3>Astra Business</h3>
              <p>For agencies, high-volume teams, and automated workflows</p>
              <div className={styles.price}>
                ₹999<span>/ month</span>
              </div>
              <span className={styles.billingNote}>
                Billed monthly · Priority SLA
              </span>
              <div className={styles.planDivider} />
              <b className={styles.includes}>Everything in Pro, plus:</b>
              <ul>
                {[
                  "1,000 actions per day enterprise limit",
                  "Multi-seat & team workflow prioritization",
                  "Custom Composio toolchains & webhooks",
                  "Dedicated support & priority SLA",
                ].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setSelectedPlan("business");
                  setCheckoutError("");
                  setShowUpgradeModal(true);
                }}
                className={`${styles.button} ${styles.darkButton}`}
              >
                Get Business (₹999) <Icon name="arrow" size={17} />
              </button>
            </article>
          </div>
          <div className={styles.brandCallout}>
            <div>
              <b>Good conversations. Great opportunities.</b>
              <p>Put your brand where everyday decisions happen.</p>
            </div>
            <Link href="/brands" className={styles.textLink}>
              Meet Astra for Brands <Icon name="arrow" size={18} />
            </Link>
          </div>
        </section>

        <section className={styles.community} aria-labelledby="community-title">
          <div className={styles.container}>
            <h2 id="community-title">A little everyday inspiration</h2>
            <p className={styles.sectionSubtitle}>
              A few conversations to have with your new favorite contact.
            </p>
            <div className={styles.communityGrid}>
              {conversationIdeas.map(([title, prompt, icon]) => (
                <a
                  key={title}
                  href={whatsapp(prompt)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.storyCard}
                >
                  <span className={styles.storyHeader}>
                    <img
                      src={asset(icon)}
                      alt=""
                      width="34"
                      height="34"
                      loading="lazy"
                    />
                    <span>
                      <b>{title}</b>
                      <small>Try asking Astra</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </span>
                  <p>“{prompt}”</p>
                  <span className={styles.storyFooter}>
                    A little help goes a long way <span>↗</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section
          id="faq"
          className={`${styles.container} ${styles.faq}`}
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title">A few things you might be wondering</h2>
          <div>
            {[
              [
                "What is Astra?",
                "Astra is your personal AI assistant on WhatsApp. It helps with email, your calendar, reminders, research, and the little things that fill up your day.",
              ],
              [
                "Do I need to download another app?",
                "No new app needed. Tap Get Started, say hi on WhatsApp, and connect the services you want Astra to help with.",
              ],
              [
                "Can I speak in Hindi or Hinglish?",
                "Yes. Text or send voice notes in English, Hindi, or Hinglish — whatever feels natural to you.",
              ],
              [
                "Can I try Astra for free?",
                "Yes. Bharat Free includes 15 AI tasks per day with curated sponsored perks. Astra Pro is ₹99 per month (80 tasks/day FUP), and Astra Business is ₹999 per month (1,000 tasks/day).",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Icon name="plus" size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="cta-title">
          <img src={asset("waves.2t7xwl857n24q.webp")} alt="" loading="lazy" />
          <div>
            <h2 id="cta-title">
              Get started
              <br />
              with just a text
            </h2>
            <div className={styles.heroActions}>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noreferrer"
                className={`${styles.button} ${styles.darkButton}`}
              >
                Get Started
              </a>
              <a
                href="#recipes"
                className={`${styles.button} ${styles.lightButton}`}
              >
                Explore Recipes
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <Link href="/" className={styles.footerBrand} aria-label="Astra home">
            <Mark />
            <span>
              A little help.
              <br />A lot more life.
            </span>
          </Link>
          <div>
            <b>Product</b>
            <a href={APP_URL}>Log in</a>
            <a href="#recipes">Recipes</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <b>Resources</b>
            <a href="#integrations">Integrations</a>
            <a href="#faq">FAQs</a>
            <a href={WA_LINK} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </div>
          <div>
            <b>Company</b>
            <Link href="/brands">For Brands</Link>
            <a href="mailto:nithindidigam@nhancio.com">Contact</a>
            <a href="https://nhancio.com" target="_blank" rel="noreferrer">
              Nhancio
            </a>
          </div>
        </div>
        <div className={`${styles.container} ${styles.footerMeta}`}>
          <span>© {new Date().getFullYear()} Astra AI</span>
          <span>Made for your everyday. Built for India.</span>
          <span className={styles.systemStatus}>
            <i /> Let&apos;s make life a little easier
          </span>
        </div>
        <div className={styles.footerWordmark} aria-hidden="true">
          astra
        </div>
      </footer>

      <dialog
        ref={upgradeDialog}
        className={styles.upgradeDialog}
        onCancel={() => setShowUpgradeModal(false)}
        onClose={() => setShowUpgradeModal(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowUpgradeModal(false);
        }}
        aria-labelledby="upgrade-title"
      >
        <div className={styles.dialogContent}>
          <button
            className={styles.closeDialog}
            aria-label="Close checkout"
            onClick={() => setShowUpgradeModal(false)}
          >
            <Icon name="close" />
          </button>
          <Mark app />
          <span className={styles.dialogEyebrow}>
            {selectedPlan === "business" ? "Astra Business · ₹999 / month" : "Astra Pro · ₹99 / month"}
          </span>
          <h2 id="upgrade-title">
            {selectedPlan === "business" ? "Enterprise Headroom." : "A little more Astra."}
          </h2>
          <p>
            Enter your WhatsApp number to continue to secure Razorpay checkout.
            Pay with UPI, cards, or UPI Autopay.
          </p>

          {/* Plan Selector inside Dialog */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => setSelectedPlan("pro")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: selectedPlan === "pro" ? "2px solid #1C1C1C" : "1px solid #DDD",
                backgroundColor: selectedPlan === "pro" ? "#1C1C1C" : "#FFF",
                color: selectedPlan === "pro" ? "#FFF" : "#1C1C1C",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Pro (₹99 / mo)
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan("business")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: selectedPlan === "business" ? "2px solid #1C1C1C" : "1px solid #DDD",
                backgroundColor: selectedPlan === "business" ? "#1C1C1C" : "#FFF",
                color: selectedPlan === "business" ? "#FFF" : "#1C1C1C",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Business (₹999 / mo)
            </button>
          </div>

          <form onSubmit={handleProUpgrade}>
            <label htmlFor="upgrade-phone">
              WhatsApp number, with country code
            </label>
            <input
              id="upgrade-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              required
              value={upgradePhone}
              onChange={(e) => setUpgradePhone(e.target.value)}
              aria-describedby={checkoutError ? "checkout-error" : undefined}
              aria-invalid={!!checkoutError}
            />
            <div className={styles.checkoutSummary}>
              <span>{selectedPlan === "business" ? "Astra Business (1,000 tasks/day) · 30 days" : "Astra Pro (80 tasks/day FUP) · 30 days"}</span>
              <b>{selectedPlan === "business" ? "₹999.00" : "₹99.00"}</b>
            </div>
            {checkoutError && (
              <p
                id="checkout-error"
                role="alert"
                className={styles.checkoutError}
              >
                {checkoutError}
              </p>
            )}
            <button
              type="submit"
              disabled={upgrading}
              className={`${styles.button} ${styles.darkButton}`}
            >
              {upgrading ? "Opening checkout…" : "Continue to Razorpay"}
              <Icon name="arrow" size={17} />
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
