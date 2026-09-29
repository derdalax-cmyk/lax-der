/**
 * Automatic permission prompting was removed: Android/TWA requires the
 * notification permission to be requested from an explicit user action.
 * Activation now happens only via PushNotificationBanner / PushSettingsRow.
 * Kept as a no-op so existing imports keep working.
 */
export function PushAutoPrompt() {
  return null;
}
