import { isMzProvince } from "./locations";
import { isValidMzMobile } from "./validation";

export const PROFILE_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
export const PROFILE_REMINDER_MS = 30 * 60 * 1000;
export type CompletionProfile = { name?: string | null; phone?: string | null; province?: string | null; city?: string | null; profile_completion_dismissed_at?: string | null };
export function missingProfileFields(p: CompletionProfile): string[] {
  return [!p.name?.trim() && "Nome", !isValidMzMobile(p.phone ?? "") && "Telefone", !isMzProvince(p.province) && "Província", !p.city?.trim() && "Cidade"].filter((v): v is string => typeof v === "string");
}
export function shouldPromptProfile(p: CompletionProfile, now = Date.now()): boolean {
  if (!missingProfileFields(p).length) return false;
  return !p.profile_completion_dismissed_at || now - Date.parse(p.profile_completion_dismissed_at) >= PROFILE_DISMISS_MS;
}
export function reminderDue(p: CompletionProfile, sentAt: string | null, now = Date.now()): boolean {
  return !!p.profile_completion_dismissed_at && !sentAt && missingProfileFields(p).length > 0 && now >= Date.parse(p.profile_completion_dismissed_at) + PROFILE_REMINDER_MS;
}
export const profileReminderKey = (userId: string, cycle: string, channel: string) => `profile-completion:${userId}:${cycle}:${channel}`;