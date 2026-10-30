"use client";

import { useState } from "react";
import { CHANNELS, GREETING, formatPhone } from "@/lib/channels";

type Channel = {
  key: string;
  title: string;
  value: string;
  display: string;
  href: string;
  icon: React.ReactNode;
};

const WhatsAppIcon = (
  <div className="h-10 w-10 rounded-[10px] bg-gradient-to-b from-[#61FD7D] to-[#25CF43] flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="white"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.01c-.24.68-1.41 1.3-1.95 1.35-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.18-4.94-4.37-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.26-.29.58-.36.77-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.2.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.7-.17 1.38z" /></svg>
  </div>
);

function buildChannels(): Channel[] {
  const text = encodeURIComponent(GREETING);
  return [
    {
      key: "whatsapp",
      title: "WhatsApp",
      value: CHANNELS.whatsapp ? `+${CHANNELS.whatsapp}` : "",
      display: formatPhone(CHANNELS.whatsapp),
      href: CHANNELS.whatsapp ? `https://wa.me/${CHANNELS.whatsapp}?text=${text}` : "",
      icon: WhatsAppIcon,
    },
  ];
}

export default function ContactChannels({ subtitle = "Ways to reach Astra directly" }: { subtitle?: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(e: React.MouseEvent, key: string, value: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-white">Contact</h2>
      <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
      <div className="mt-4 border-t border-white/80">
        {buildChannels().map((c) => {
          const live = Boolean(c.href);
          const Row = live ? "a" : "div";
          return (
            <Row
              key={c.key}
              {...(live ? { href: c.href, target: c.key === "whatsapp" ? "_blank" : undefined, rel: "noreferrer" } : {})}
              className={`group flex items-center gap-4 px-3 py-5 border-b border-white/10 transition ${live ? "hover:bg-white/[0.03] cursor-pointer" : "opacity-60"}`}
            >
              {c.icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{c.title}</p>
                {live ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm text-slate-400 truncate">{c.display}</span>
                    <button
                      onClick={(e) => copy(e, c.key, c.value)}
                      aria-label={`Copy ${c.title}`}
                      className="p-1 rounded text-slate-500 hover:text-white"
                    >
                      {copied === c.key ? (
                        <span className="text-[11px] text-emerald-400">Copied</span>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 mt-0.5">Coming soon</p>
                )}
              </div>
              {live && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500 group-hover:text-white transition" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
              )}
            </Row>
          );
        })}
      </div>
    </section>
  );
}
