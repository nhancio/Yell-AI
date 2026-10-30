import type { Metadata } from "next";

const CHECKED = "31 October 2026";

export const metadata: Metadata = {
  title: "Best AI Assistants on WhatsApp in India (2026), Compared",
  description:
    "Meta AI, ChatGPT, Perplexity, Puch AI and Astra on WhatsApp, compared for India: languages, price in ₹, how to start, and what each is best at.",
  alternates: { canonical: "/whatsapp-ai-assistants" },
};

type Row = { name: string; start: string; languages: string; price: string; groups: string; best: string };
const ROWS: Row[] = [
  { name: "Meta AI", start: "Built into WhatsApp", languages: "English at India launch", price: "Free", groups: "Yes", best: "Quick in-chat help" },
  { name: "ChatGPT", start: "Save 1-800-242-8478", languages: "Not confirmed for WhatsApp", price: "Free tier", groups: "No", best: "Writing and conversation" },
  { name: "Perplexity", start: "Save its WhatsApp number", languages: "Not confirmed", price: "Free tier", groups: "Not confirmed", best: "Answers with cited sources" },
  { name: "Puch AI", start: "Save its WhatsApp number", languages: "Hindi, Marathi, Tamil, Telugu, Bengali, Kannada, Punjabi", price: "Reported free", groups: "Not confirmed", best: "Voice-first, many Indian languages" },
  { name: "Astra", start: "Sign in at tryastra.web.app", languages: "English, Hindi, Hinglish, Telugu, Tamil", price: "Free 5/day · Pro ₹99/mo", groups: "No", best: "Short drafts, plans, and linked-app actions" },
];

const FAQ: [string, string][] = [
  ["Is there a free AI assistant on WhatsApp?", "Yes. Meta AI is free and built into WhatsApp. ChatGPT and Perplexity offer free tiers, Puch AI is reported as free, and Astra includes 5 free messages a day."],
  ["Which WhatsApp AI works in Hindi?", "Puch AI lists the widest set of Indian languages. Astra replies in Hindi, Hinglish, Telugu and Tamil. Meta AI launched in India in English."],
  ["Does ChatGPT on WhatsApp work in India?", `Reports conflict. Some launch coverage says it works in India and others say it does not. As of ${CHECKED}, message 1-800-242-8478 on WhatsApp to check for yourself.`],
  ["Can an AI assistant on WhatsApp send emails for me?", "Astra can, once you link Gmail in your account: it shows a preview and sends only after you reply YES. The other assistants in this list answer questions in chat."],
];

const SOURCES: [string, string][] = [
  ["Smartprix: Meta AI available in India", "https://us.smartprix.com/bytes/meta-ai-is-now-available-in-india-how-can-you-use-the-chatbot-on-whatsapp-instagram"],
  ["MundoBytes: Meta AI vs ChatGPT on WhatsApp", "https://mundobytes.com/en/meta-ai-vs-chatgpt-whatsapp"],
  ["OpenAI: ChatGPT in WhatsApp", "https://chatgpt.com/hi-IN/features/chatgpt-in-whatsapp/"],
  ["YourStory: ChatGPT WhatsApp hotline", "https://ts.yourstory.com/2024/12/chatgpt-available-on-whatsapp-dedicated-hotline"],
  ["Outlook Business: ChatGPT on WhatsApp", "https://www.outlookbusiness.com/news/whatsapp-welcomes-chatgpt-how-does-openais-new-experiment-work"],
  ["BGR: Perplexity on WhatsApp", "https://bgr.com/tech/perplexity-ai-now-works-in-whatsapp-heres-how-to-use-it/"],
  ["Storyboard18: Puch AI", "https://www.storyboard18.com/digital/puch-ai-bets-on-indias-most-expensive-mobile-number-to-challenge-chatgpt-and-grok-80124.htm"],
  ["AI Agents Directory: Puch AI", "https://aiagentsdirectory.com/agent/puch-ai"],
];

const cell = { padding: "10px 12px", borderBottom: "1px solid #334155", textAlign: "left" as const, verticalAlign: "top" as const };

export default function WhatsAppAssistantsPage() {
  return (
    <main style={{ maxWidth: 860, margin: "60px auto", padding: "0 24px", lineHeight: 1.8 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
          }),
        }}
      />
      <a href="/">← Astra</a>
      <h1 style={{ fontSize: 36, lineHeight: 1.25, margin: "24px 0" }}>Best AI Assistants on WhatsApp in India (2026)</h1>
      <p>
        <strong>Short answer:</strong> use Meta AI for quick help without saving a number, ChatGPT for writing,
        Perplexity for answers with sources, Puch AI for voice and the widest set of Indian languages, and Astra
        for short drafts and plans that can become real emails, events and tasks once you link your apps.
      </p>
      <p style={{ fontSize: 14, opacity: 0.75 }}>
        Checked {CHECKED}. Astra is made by Nhancio, the publisher of this page. Details for other assistants come
        from their own pages and press coverage (sources below), not hands-on testing, and may change.
      </p>

      <h2>Quick comparison</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 15 }}>
          <thead>
            <tr>{["Assistant", "How to start", "Indian languages", "Price", "Group chats", "Best for"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name}>
                <td style={cell}><strong>{r.name}</strong></td>
                <td style={cell}>{r.start}</td>
                <td style={cell}>{r.languages}</td>
                <td style={cell}>{r.price}</td>
                <td style={cell}>{r.groups}</td>
                <td style={cell}>{r.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>The assistants</h2>
      <h3>Meta AI</h3>
      <p>Built into WhatsApp, so there is no contact to save, and it works inside group chats. Reviews rate it well for speed and up-to-date answers. It reached India first in English.</p>
      <h3>ChatGPT</h3>
      <p>Save 1-800-242-8478 (1-800-CHATGPT) and send the first message; it never starts a chat. Launch coverage says no OpenAI account is needed, and it does not join group chats. Reports conflict on whether it works in India, so test it before relying on it.</p>
      <h3>Perplexity</h3>
      <p>A search-led assistant that looks up the web and cites its sources, which suits research questions. Add its number from Perplexity&apos;s official site.</p>
      <h3>Puch AI</h3>
      <p>An India-first assistant built around voice, with replies in Hindi, Marathi, Tamil, Telugu, Bengali, Kannada and Punjabi. The company says it has close to one million users in India. Sources list different numbers, so get the number from its official site.</p>
      <h3>Astra</h3>
      <p>
        An India-first assistant that keeps answers short enough to read on a phone, typically replying in about
        3–4 seconds in English, Hindi, Hinglish, Telugu or Tamil. Link Gmail, Google Calendar, Todoist or Google
        Tasks and it can send an email or add an event or task, after showing a preview and waiting for your YES.
        It does not yet understand voice notes, join group chats, or search the web. Free includes 5 messages a day;
        Pro is ₹99 a month (10 a day) and Business ₹299 a month (30 a day). <a href="/#pricing">See plans</a>.
      </p>

      <h2>Which one should you use?</h2>
      <ul>
        <li><strong>No setup at all:</strong> Meta AI, already in your WhatsApp.</li>
        <li><strong>Polished writing:</strong> ChatGPT.</li>
        <li><strong>Facts with links to check:</strong> Perplexity.</li>
        <li><strong>Voice, or a regional language beyond Hindi:</strong> Puch AI.</li>
        <li><strong>Emails, events and tasks done from chat, with your approval:</strong> Astra.</li>
      </ul>

      <h2>How to add an AI assistant to WhatsApp</h2>
      <ol>
        <li>Get the assistant&apos;s official WhatsApp number from its own website.</li>
        <li>Save it as a contact, or tap its WhatsApp link.</li>
        <li>Send the first message; assistants on WhatsApp only reply, they never message you first.</li>
      </ol>

      <h2>Frequently asked questions</h2>
      {FAQ.map(([q, a]) => (
        <div key={q}>
          <h3>{q}</h3>
          <p>{a}</p>
        </div>
      ))}

      <h2>Sources</h2>
      <ul style={{ fontSize: 14 }}>
        {SOURCES.map(([label, url]) => (
          <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{label}</a></li>
        ))}
      </ul>
      <p>
        Read our <a href="/privacy">privacy policy</a> or <a href="/">try Astra</a>.
      </p>
    </main>
  );
}
