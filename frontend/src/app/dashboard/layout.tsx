import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-claw-surface/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-semibold text-claw-accent">
            Yell AI
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-claw-muted hover:text-white text-sm"
            >
              Home
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">{children}</main>
    </div>
  );
}
