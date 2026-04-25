export type IosShareLocation = "top" | "bottom";

export function detectIosMajorVersion(ua: string): number {
  const osMatch = ua.match(/OS (\d+)[._]/);
  if (osMatch) return parseInt(osMatch[1], 10);
  const versionMatch = ua.match(/Version\/(\d+)/);
  if (versionMatch) return parseInt(versionMatch[1], 10);
  return 0;
}

export function isIpadUserAgent(ua: string, hasTouchOnMac: boolean): boolean {
  if (/iPad/.test(ua)) return true;
  // iPadOS in "Request Desktop Site" (default since iPadOS 13) reports as
  // "Macintosh" with touch events available. Crucially, iPhone UAs include
  // the substring "Mac" inside "like Mac OS X" and modern iPhones also have
  // ontouchend on document, so we must match only the literal "Macintosh"
  // token (which iPhone/iPod UAs never contain) and explicitly exclude any
  // UA that names iPhone/iPod.
  if (/iPhone|iPod/.test(ua)) return false;
  return /Macintosh/.test(ua) && hasTouchOnMac;
}

export function isIosUserAgent(ua: string, hasTouchOnMac: boolean): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && hasTouchOnMac;
}

export function pickIosShareLocation(
  ua: string,
  hasTouchOnMac: boolean,
): IosShareLocation {
  if (isIpadUserAgent(ua, hasTouchOnMac)) return "top";
  const major = detectIosMajorVersion(ua);
  return major >= 15 ? "top" : "bottom";
}

export function detectIosShareLocation(): IosShareLocation {
  if (typeof navigator === "undefined") return "bottom";
  const hasTouchOnMac =
    typeof document !== "undefined" && "ontouchend" in document;
  return pickIosShareLocation(navigator.userAgent, hasTouchOnMac);
}

export function isIosSafariBrowser(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  const hasTouchOnMac =
    typeof document !== "undefined" && "ontouchend" in document;
  if (!isIosUserAgent(navigator.userAgent, hasTouchOnMac)) return false;
  const standalone = (window.navigator as unknown as { standalone?: boolean })
    .standalone === true;
  return !standalone;
}
