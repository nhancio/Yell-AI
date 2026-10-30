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

export interface SessionUser {
  uid: string;
  phoneNumber: string | null;
  getIdToken: () => Promise<string>;
}

const WA_STORAGE_KEY = "astra:wa_session";
const WA_EVENT = "astra:wa_session_change";

export function loadWhatsAppSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; phoneNumber?: string };
    if (!parsed?.token || !parsed?.phoneNumber) return null;
    const { token, phoneNumber } = parsed;
    return {
      uid: `wa:${phoneNumber.replace(/\D/g, "")}`,
      phoneNumber,
      getIdToken: async () => token,
    };
  } catch {
    return null;
  }
}

export function saveWhatsAppSession(token: string, phoneNumber: string): SessionUser {
  try {
    localStorage.setItem(WA_STORAGE_KEY, JSON.stringify({ token, phoneNumber }));
    window.dispatchEvent(new Event(WA_EVENT));
  } catch {
    /* Storage disabled */
  }
  return {
    uid: `wa:${phoneNumber.replace(/\D/g, "")}`,
    phoneNumber,
    getIdToken: async () => token,
  };
}

export function clearWhatsAppSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WA_STORAGE_KEY);
    window.dispatchEvent(new Event(WA_EVENT));
  } catch {
    /* Storage disabled */
  }
}

export function subscribeWhatsAppSession(listener: () => void): () => void {
  window.addEventListener(WA_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(WA_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || ""}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg;
    throw new Error(detail || `Request failed (${response.status}). Please try again.`);
  }
  return body;
}

export async function accountApi<T>(user: SessionUser, path: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || ""}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token.startsWith("wa.")) {
      clearWhatsAppSession();
    }
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg;
    throw new Error(detail || `Request failed (${response.status}). Please try again.`);
  }
  return body;
}
