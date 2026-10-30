"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConnectPage() {
  const router = useRouter();
  useEffect(() => {
    const connected = new URLSearchParams(window.location.search).get("connected");
    const query = connected ? `?connected=${encodeURIComponent(connected)}` : "";
    router.replace(`/app${query}`);
  }, [router]);
  return (
    <main className="min-h-screen bg-[#070b14] text-white flex items-center justify-center p-6">
      <p>Opening your account… <Link href="/app" className="underline">Sign in to connect your apps</Link></p>
    </main>
  );
}
