"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConnectPage() {
  const router = useRouter();
  useEffect(() => {
    const connected = new URLSearchParams(window.location.search).get("connected");
    const query = connected ? `?connected=${encodeURIComponent(connected)}` : "";
    router.replace(`/${query}`);
  }, [router]);
  return (
    <main style={{ minHeight: "100vh", background: "#fffdfa", color: "#18241d", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <p>Opening Astra AI…</p>
    </main>
  );
}
