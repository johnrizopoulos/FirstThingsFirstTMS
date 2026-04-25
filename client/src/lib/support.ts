const DEFAULT_SUPPORT_EMAIL = "firstthingsfirsttms@gmail.com";

const fromEnv = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim();

export const SUPPORT_EMAIL = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_SUPPORT_EMAIL;

export function supportMailtoHref(subject?: string): string {
  if (!subject) return `mailto:${SUPPORT_EMAIL}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
