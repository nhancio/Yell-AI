import type { User } from "firebase/auth";

export const INTERESTS = [
  ["email", "Email"], ["calendar", "Calendar"], ["reminders", "Reminders"],
  ["notes", "Notes"], ["research", "Research"], ["news", "News"],
  ["automations", "Automations"], ["daily_brief", "Daily Brief"], ["sports", "Sports"],
  ["travel", "Travel"], ["images", "Images"], ["finances", "Finances"],
  ["shopping", "Shopping"], ["reservations", "Reservations"], ["coding", "Coding"],
] as const;

export type Interest = (typeof INTERESTS)[number][0];
export type SetupStep = "name" | "interests" | "apps" | "ready" | "plan" | "complete";
export interface Setup {
  name: string | null;
  interests: Interest[];
  step: SetupStep;
  completed: boolean;
  completed_at: string | null;
}
export type SetupPatch = Partial<Pick<Setup, "name" | "interests" | "step">>;
export interface Connection {
  slug: string; name: string; icon: string; description: string; category: string;
  status: string; configured: boolean;
}
export interface Plan {
  id: "pro" | "business"; name: string; price_inr: number; daily_limit: number;
}
export interface Account {
  phone_number: string; name: string | null; member_since: string | null;
  plan: { is_premium: boolean; name: string; expires_at: string | null; price_inr: number };
  usage: { used_today: number; daily_limit: number };
  whatsapp_number: string; connections: Connection[]; available_plans: Plan[];
}

export async function accountApi<T>(user: User, path: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || ""}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg;
    throw new Error(detail || `Request failed (${response.status}). Please try again.`);
  }
  return body;
}
