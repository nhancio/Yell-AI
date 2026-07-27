import Link from "next/link";

const SKILLS = [
  "Rant about your day and get useful help back",
  "Draft replies, plans, summaries, and follow-ups",
  "Run research and browser tasks for you",
  "Keep memory across your chats",
  "Handle your personal admin from WhatsApp",
  "Turn your self-chat into an always-on AI workspace",
];

const FLOW_STEPS = [
  {
    title: "Click Deploy Now",
    description:
      "The user lands on Yell AI, enters the few deployment inputs we need, and starts a managed NanoClaw runtime.",
  },
  {
    title: "Scan the QR code",
    description:
      "NanoClaw kicks off WhatsApp auth and emits a QR code. We surface that QR directly in the UI so the user never leaves the product flow.",
  },
  {
    title: "Start chatting in WhatsApp",
    description:
      "Once the scan succeeds, we register the self-chat, bring the assistant online, and the user can talk to it on WhatsApp with the chosen trigger.",
  },
];

const DEFAULTS = [
  {
    label: "Assistant name",
    detail: "Yell by default. The user can change it before deployment and it becomes the WhatsApp trigger.",
  },
  {
    label: "Claude credential",
    detail: "The user can paste an Anthropic API key or Claude OAuth token, or the server can provide a default credential.",
  },
  {
    label: "WhatsApp connection",
    detail: "This flow uses QR-based WhatsApp auth. The user scans once and starts chatting in a self-chat without configuring WhatsApp Business API credentials.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-claw-surface/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold text-claw-accent">Yell AI</span>
            <span className="text-xs text-claw-muted border border-claw-surface rounded px-2 py-0.5">powered by NanoClaw</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="bg-claw-accent text-claw-dark px-4 py-2 rounded-lg font-medium hover:opacity-90 transition"
            >
              Deploy your AI
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-16">
        <section className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-claw-accent font-medium mb-4 tracking-wider uppercase">
            Managed WhatsApp AI deployment with NanoClaw under the hood.
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Deploy now, scan the QR, and start talking to your AI on WhatsApp.
          </h1>
          <p className="mt-6 text-lg text-claw-muted max-w-2xl mx-auto">
            Yell AI handles the runtime setup for you. The user flow is simple: click deploy, wait for the QR, scan it with WhatsApp, and start chatting.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link
              href="/dashboard"
              className="bg-claw-accent text-claw-dark px-6 py-3 rounded-lg font-semibold text-lg hover:opacity-90 transition"
            >
              Deploy Now
            </Link>
            <a
              href="#skills"
              className="border border-claw-surface text-claw-muted px-6 py-3 rounded-lg font-medium hover:border-claw-accent hover:text-white transition"
            >
              See what it can do
            </a>
          </div>
        </section>

        <section className="mt-16 max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Transparent flow from deploy to chat
          </h2>
          <p className="text-claw-muted text-center mb-8">
            The dashboard owns the entire onboarding flow from deploy request to QR scan to live WhatsApp chat.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {FLOW_STEPS.map((step) => (
              <article
                key={step.title}
                className="rounded-2xl border border-claw-surface/70 bg-claw-surface/60 p-5 text-left"
              >
                <p className="text-xs uppercase tracking-wider text-claw-accent font-semibold">
                  Flow
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white-light">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-claw-muted leading-relaxed">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-claw-accent/30 bg-claw-dark/60 p-6">
            <h2 className="text-2xl font-bold">Onboarding defaults</h2>
            <p className="text-claw-muted text-sm mt-2">
              We only ask for the minimum inputs required to bring the assistant online cleanly.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {DEFAULTS.map((item) => (
                <li key={item.label} className="space-y-1">
                  <p className="text-claw-accent font-medium">{item.label}</p>
                  <p className="text-claw-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="skills" className="mt-24 max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            What can Yell AI do for you?
          </h2>
          <p className="text-claw-muted text-center mb-8">
            One assistant for your career, your stress, and your daily life
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {SKILLS.map((skill) => (
              <span
                key={skill}
                className="px-4 py-2 rounded-full bg-claw-surface/60 border border-claw-surface text-sm text-claw-muted hover:text-white hover:border-claw-accent/50 transition"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>

        <section id="compare" className="mt-24 w-full max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            From click to chat
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-claw-surface/50 border border-claw-surface rounded-xl p-6">
              <h3 className="font-semibold text-claw-muted mb-4">What usually happens</h3>
              <ul className="space-y-2 text-sm text-claw-muted">
                <li>• You install tools manually</li>
                <li>• You configure the runtime yourself</li>
                <li>• You authenticate WhatsApp in the terminal</li>
                <li>• You debug setup before the first reply</li>
              </ul>
              <p className="mt-4 text-red-400 font-medium">Too much setup before the first message</p>
            </div>
            <div className="bg-claw-surface/50 border border-claw-accent/30 rounded-xl p-6">
              <h3 className="font-semibold text-claw-accent mb-4">Yell AI + NanoClaw</h3>
              <ul className="space-y-2 text-sm text-claw-muted">
                <li>• Click Deploy Now</li>
                <li>• We create and start your NanoClaw runtime</li>
                <li>• We show the WhatsApp QR code in the UI</li>
                <li>• You scan once and start chatting</li>
              </ul>
              <p className="mt-4 text-claw-accent font-medium">Deploy. Scan. Chat.</p>
            </div>
          </div>
        </section>

        <section className="mt-20 text-center max-w-2xl mx-auto">
          <p className="text-claw-muted text-sm">
            Yell AI is powered by <span className="text-claw-accent">NanoClaw</span> — the open-source AI agent framework. Your own AI, your own instance, your own data.
          </p>
        </section>
      </main>

      <footer className="border-t border-claw-surface/50 py-6 text-center text-claw-muted text-sm">
        Yell AI — your personal AI assistant, which you can yell at.
      </footer>
    </div>
  );
}
