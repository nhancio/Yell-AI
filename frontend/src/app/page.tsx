"use client";

import Link from "next/link";
import { FAQS } from "@/lib/faq";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import styles from "./home.module.css";
const APP_ENTRY = "/app";
const startWithPrompt = (text: string) => `${APP_ENTRY}?prompt=${encodeURIComponent(text)}`;
const asset = (name: string) => `/poke/${name}`;
const apps = [
  ["Gmail", "gmailapp.webp"],
  ["Google Calendar", "googlecalendarapp.webp"],
  ["Notion", "notionapp.webp"],
  ["Todoist", "todoistapp.webp"],
  ["Outlook", "outlookapp.webp"],
  ["GitHub", "githubapp.webp"],
  ["Strava", "stravaapp.webp"],
];
const recipes = [
  {
    name: "Executive assistant",
    icon: "googlecalendarapp.webp",
    title: "A little less admin. A lot more life.",
    description: "Emails, plans, and to-do lists. All in one text.",
    prompt:
      "Bhai, Rahul ko kal subah 11 baje Google Meet ke liye ek short mail draft karo.",
  },
  {
    name: "Founder outreach",
    icon: "githubapp.webp",
    title: "Your next opportunity, one text away.",
    description: "Make the right connections, with a little help.",
    prompt:
      "Draft a short intro to a Bengaluru AI startup founder. I'm a full-stack engineer who has shipped two React apps.",
  },
  {
    name: "Everyday life",
    icon: "gmailapp.webp",
    title: "All the little things, a little easier.",
    description: "Quick replies, checklists, and everything in between.",
    prompt:
      "Turn this into a checklist I can paste into Notion: pay rent, call the plumber, buy milk, book the dentist.",
  },
];
const conversationIdeas = [
  [
    "A calmer morning",
    "Help me plan today: three meetings, a deck due at 5, and the gym. What should I do first?",
    "googlecalendarapp.webp",
  ],
  [
    "An inbox that feels lighter",
    "Draft a polite reply saying I can't make Friday's call but Monday at 11 works.",
    "gmailapp.webp",
  ],
  [
    "Room for your next big idea",
    "Turn these rough notes into a tidy list of next steps: launch page, pricing, find 10 beta users.",
    "notionapp.webp",
  ],
  [
    "A little help getting there",
    "My flight leaves Bengaluru at 7 AM. What time should I leave home, and what should I pack?",
    "gmailapp.webp",
  ],
  [
    "Your next chapter",
    "Help me write a short intro to a startup founder about my two projects: a budgeting app and a Telugu chatbot.",
    "githubapp.webp",
  ],
  [
    "The everyday, sorted",
    "I spent ₹4,200 on Swiggy and ₹3,100 on Blinkit this month. How can I cut that by a third?",
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
          d="M20 5 7 38M20 5l13 33M11.5 27h17"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 14l4.5 9h-9L20 14Z"
          fill="currentColor"
          opacity="0.28"
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
      aria-label="Example WhatsApp conversation with Astra AI drafting a meeting email"
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
            Bhai, draft a mail to Rahul for a Meet at 11 tomorrow
          </p>
          <p className={styles.incoming}>
            here you go 👇 <b>Subject:</b> Quick sync tomorrow at 11?
          </p>
          <p className={styles.incoming}>
            copy, paste, send ✨ want a shorter version too?
          </p>
          <p className={styles.outgoing}>perfect, thanks 😭</p>
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
  useEffect(() => {
    if (window.location.hash === "#login" || new URLSearchParams(window.location.search).has("connected")) {
      window.location.replace(`/app${window.location.search}`);
      return;
    }
    QRCode.toDataURL(new URL(APP_ENTRY, window.location.origin).href, {
      width: 180,
      margin: 1,
      color: { dark: "#18241d", light: "#FFFFFF" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));

  }, []);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 70);
    const closeDropdowns = (e: MouseEvent) => {
      const target = e.target as Element | null;
      document
        .querySelectorAll<HTMLDetailsElement>(`.${styles.navDropdown}[open]`)
        .forEach((el) => {
          if (!el.contains(target) || target?.closest("a")) el.open = false;
        });
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    document.addEventListener("click", closeDropdowns);
    return () => {
      window.removeEventListener("scroll", updateHeader);
      document.removeEventListener("click", closeDropdowns);
    };
  }, []);

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
            <details name="nav" className={styles.navDropdown}>
              <summary>
                Product <span>⌄</span>
              </summary>
              <div>
                <a href="#experience">Meet Astra</a>
                <a href="#recipes">Recipes</a>
                <a
                  href={APP_ENTRY}
                >
                  Astra App <Icon name="arrow" size={14} />
                </a>
              </div>
            </details>
            <details name="nav" className={styles.navDropdown}>
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
            <a
              href={APP_ENTRY}
              className={styles.login}
            >
              Log in
            </a>
            <a
              href={APP_ENTRY}
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
              <a
                href={APP_ENTRY}
              >
                Log in
              </a>
            </nav>
          )}
        </header>
        <section
          className={styles.hero}
          id="experience"
          aria-labelledby="hero-title"
        >
          <a href={APP_ENTRY} className={styles.announcement}>
            <span>New</span> Your everyday, a little easier{" "}
            <Icon name="chevron" size={14} />
          </a>
          <h1 id="hero-title">
            Meet Astra,
            <br />
            your new favorite contact
          </h1>
          <p className={styles.heroSubtitle}>
            Your personal AI assistant, right in your WhatsApp
          </p>
          <div className={styles.heroActions}>
            <a
              href={APP_ENTRY}
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
          <p className={styles.entryNote}>Verify your number once, then chat on WhatsApp.</p>
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
                  Scan to get started <Icon name="chevron" size={13} />
                </button>
                {showQr && (
                  <div className={styles.qrPanel} id="whatsapp-qr">
                    <img
                      src={qrUrl}
                      width="160"
                      height="160"
                      alt="Scan this QR code to sign in to Astra"
                    />
                    <p>
                      Open your camera.
                      <br />
                      Sign in, then open WhatsApp.
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
            {[apps.slice(0, 4), apps.slice(4)].map((row, rowIndex) => (
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
              href={APP_ENTRY}
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
                Pick a recipe, send it on WhatsApp, and get a ready-to-use
                draft back in seconds.
              </p>
              <p className={styles.recipeTitle} aria-live="polite">
                {recipes[activeRecipe].title}
              </p>
              <a
                href={startWithPrompt(recipes[activeRecipe].prompt)}
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
                <span className={styles.voiceLabel}>Message</span>
                <p>
                  “Kal plan karo: 10 baje standup,
                  <br />
                  2 baje client call, 6 baje gym.”
                </p>
                <span className={styles.voiceReply}>
                  <Icon name="check" size={16} /> Here&apos;s your day, block by
                  block.
                </span>
              </div>
            </div>
            <div className={styles.featureCopy}>
              <span className={styles.number}>(3)</span>
              <h2 id="schedule-title">
                Plans around
                <br />
                your schedule
              </h2>
              <p>
                Send your day in one line and get back a clear plan you can
                follow. In English, Hindi, Hinglish, Telugu, or Tamil.
              </p>
              <a
                href={APP_ENTRY}
                className={styles.textLink}
              >
                Plan my day <Icon name="arrow" size={18} />
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
                    Here are 3 talking points for your 5 PM call with Priya,
                    based on what you shared.
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.featureCopy}>
              <span className={styles.number}>(4)</span>
              <h2 id="proactive-title">
                Ready the moment
                <br />
                you text
              </h2>
              <p>
                Text Astra before a call or a busy day and get talking points,
                drafts, or a quick plan back in seconds. It only replies to you,
                and never messages first.
              </p>
              <a
                href={APP_ENTRY}
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
                <p>Draft a follow-up to today&apos;s client call</p>
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
                Link Gmail, Calendar, Notion, and 14 more apps to your account.
                Astra drafts the work right inside WhatsApp, and you decide what
                gets sent.
              </p>
              <a
                href={APP_ENTRY}
                className={styles.textLink}
              >
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
                  "5 messages per day (Ad-supported)",
                  "Link Gmail, Calendar, Notion & 14 more apps",
                  "Drafts, day plans & quick answers",
                  "English, Hindi, Hinglish, Telugu & Tamil",
                ].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={APP_ENTRY}
                className={`${styles.button} ${styles.lightButton}`}
              >
                Create free account
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
                  "10 messages per day",
                  "2× the Free daily limit",
                  "Founder cold outreach & custom drafts",
                  "100% Ad-Free experience",
                ].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/payment/checkout?plan=pro"
                className={`${styles.button} ${styles.darkButton}`}
              >
                Get Pro (₹99) <Icon name="arrow" size={17} />
              </a>
            </article>

            {/* Business / Team Plan */}
            <article className={`${styles.plan} ${styles.proPlan}`}>
              <span className={styles.planBadge}>
                Most Room
              </span>
              <h3>Astra Business</h3>
              <p>For people who text Astra all through the day</p>
              <div className={styles.price}>
                ₹299<span>/ month</span>
              </div>
              <span className={styles.billingNote}>
                Billed monthly · 30 days of access
              </span>
              <div className={styles.planDivider} />
              <b className={styles.includes}>Everything in Pro, plus:</b>
              <ul>
                {[
                  "30 messages per day",
                  "3× the Pro daily limit",
                ].map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/payment/checkout?plan=business"
                className={`${styles.button} ${styles.darkButton}`}
              >
                Get Business (₹299) <Icon name="arrow" size={17} />
              </a>
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
                  href={startWithPrompt(prompt)}
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
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQS.map(([name, text]) => ({
                  "@type": "Question",
                  name,
                  acceptedAnswer: { "@type": "Answer", text },
                })),
              }),
            }}
          />
          <div>
            {FAQS.map(([question, answer]) => (
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
              Verify your number
              <br />
              then start with a text
            </h2>
            <div className={styles.heroActions}>
              <a
                href={APP_ENTRY}
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
            <a
              href={APP_ENTRY}
            >
              Log in
            </a>
            <a href="#recipes">Recipes</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <b>Resources</b>
            <a href="#integrations">Integrations</a>
            <a href="#faq">FAQs</a>
            <a href={APP_ENTRY}>
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


    </div>
  );
}
