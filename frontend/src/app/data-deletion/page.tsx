import type { Metadata } from "next";

export const metadata: Metadata = { title: "Astra — Data Deletion" };

export default function DataDeletionPage() {
  return (
    <main style={{ maxWidth: 760, margin: "60px auto", padding: "0 24px", lineHeight: 1.8 }}>
      <a href="/">← Astra</a>
      <h1 style={{ fontSize: 36, margin: "24px 0" }}>Request data deletion</h1>
      <p>To request deletion of your Astra account and associated personal data, email <a href="mailto:nithindidigam@nhancio.com?subject=Astra%20data%20deletion%20request">nithindidigam@nhancio.com</a> with the subject “Astra data deletion request”.</p>
      <ol style={{ paddingLeft: 24 }}>
        <li>Include the phone number you used with Astra, including the country code.</li>
        <li>Tell us whether you want to delete the whole account or specific information.</li>
        <li>Complete any ownership verification we request. Do not email passwords, OTPs, access tokens, or payment-card details.</li>
      </ol>
      <p>Requests are handled manually. We will confirm receipt and explain any verification steps, retention requirements, or completion details. Some records may need to be retained for legal obligations, payment reconciliation, security, or disputes.</p>
      <p>You can also revoke Astra’s access in each connected provider’s account settings. Clearing conversation context or disconnecting an integration does not by itself delete all account records. Deleting Astra data does not delete your WhatsApp, Google, or other third-party accounts.</p>
      <p>Read our <a href="/privacy">Privacy Policy</a> for more information.</p>
    </main>
  );
}
