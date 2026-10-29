import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yell AI — India's Personal AI Super-Agent on WhatsApp",
  description:
    "Connect Gmail, Google Calendar, Notion, GitHub & LinkedIn once via Composio. Do everything inside WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen font-sans bg-[#070b14] text-slate-100">
        {children}
      </body>
    </html>
  );
}
