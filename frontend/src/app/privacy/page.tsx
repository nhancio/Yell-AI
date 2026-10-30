import type { Metadata } from "next";

export const metadata: Metadata = { title: "Astra — Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "60px auto", padding: "0 24px", lineHeight: 1.8 }}>
      <a href="/">← Astra</a>
      <h1 style={{ fontSize: 36, margin: "24px 0" }}>Privacy Policy</h1>
      <p>Last updated: 30 October 2026</p>
      <p>Astra is an AI assistant operated by Nhancio. This policy describes how information is handled when you use our website, assistant, WhatsApp channel, and optional connected services.</p>
      <h2>Information we process</h2>
      <p>We process your phone number, profile information you provide, messages and requests, assistant responses, selected interests, account and subscription status, usage counts, and technical logs. If you connect another service, we process connection identifiers, authorization status, and the information needed to perform the actions you request.</p>
      <h2>How information is used</h2>
      <p>We use this information to authenticate you, respond to requests, maintain conversation context, operate connected features, manage usage and subscriptions, troubleshoot failures, and protect the service. Where sponsored content is enabled, message topics or intent may be used to select contextual offers.</p>
      <h2>Service providers</h2>
      <p>Using WhatsApp involves Meta. Assistant requests and relevant conversation context are sent to Google Gemini for processing. Google Firebase supports authentication and hosting. Optional integrations use Composio and the services you authorize. Paid subscriptions use Razorpay. These providers process information needed for their functions under their own terms and privacy policies; processing may occur outside your country.</p>
      <h2>Storage and retention</h2>
      <p>Account records, conversation records, connection metadata, usage records, and diagnostic logs may be stored by Astra and its providers. The short-term conversation cache has a 24-hour expiry after activity; this is not a promise that all stored records are erased after 24 hours. Disconnecting a service or clearing chat context does not automatically delete every account record.</p>
      <h2>Your choices and deletion requests</h2>
      <p>You can stop messaging Astra and revoke integrations through the connected provider. To request access, correction, or deletion of Astra data, email <a href="mailto:nithindidigam@nhancio.com">nithindidigam@nhancio.com</a> and identify the phone number associated with your account. We may need to verify account ownership. See our <a href="/data-deletion">data deletion instructions</a>. Records required for legal obligations, payment reconciliation, security, or resolving disputes may need to be retained.</p>
      <h2>Contact and changes</h2>
      <p>For privacy questions, contact <a href="mailto:nithindidigam@nhancio.com">nithindidigam@nhancio.com</a>. Updates to this policy will be posted on this page with a revised date.</p>
    </main>
  );
}
