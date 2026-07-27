import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yell AI — Deploy your WhatsApp AI assistant",
  description:
    "Deploy a NanoClaw-powered assistant, scan the WhatsApp QR code, and start chatting in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
