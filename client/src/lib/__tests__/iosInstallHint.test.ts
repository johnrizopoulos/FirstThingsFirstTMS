import { describe, it, expect } from "vitest";
import {
  detectIosMajorVersion,
  isIpadUserAgent,
  isIosUserAgent,
  pickIosShareLocation,
} from "../iosInstallHint";

const UA = {
  iphoneIos17:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneIos15:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  iphoneIos14:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
  iphoneIos12:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 12_5_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1",
  ipadLegacy:
    "Mozilla/5.0 (iPad; CPU OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
  desktopMacSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
};

describe("detectIosMajorVersion", () => {
  it("parses iOS major versions from iPhone UA strings", () => {
    expect(detectIosMajorVersion(UA.iphoneIos17)).toBe(17);
    expect(detectIosMajorVersion(UA.iphoneIos15)).toBe(15);
    expect(detectIosMajorVersion(UA.iphoneIos14)).toBe(14);
    expect(detectIosMajorVersion(UA.iphoneIos12)).toBe(12);
  });

  it("parses iPadOS versions from legacy iPad UA strings", () => {
    expect(detectIosMajorVersion(UA.ipadLegacy)).toBe(13);
  });

  it("falls back to Version/N for desktop-mode iPadOS UA", () => {
    expect(detectIosMajorVersion(UA.ipadDesktopMode)).toBe(16);
  });

  it("returns 0 for non-iOS UAs without an OS or Version segment", () => {
    expect(detectIosMajorVersion("Mozilla/5.0 something")).toBe(0);
  });
});

describe("isIpadUserAgent", () => {
  it("matches a literal iPad UA", () => {
    expect(isIpadUserAgent(UA.ipadLegacy, false)).toBe(true);
    expect(isIpadUserAgent(UA.ipadLegacy, true)).toBe(true);
  });

  it("matches a Macintosh UA only when touch is reported (iPadOS desktop mode)", () => {
    expect(isIpadUserAgent(UA.ipadDesktopMode, true)).toBe(true);
    expect(isIpadUserAgent(UA.desktopMacSafari, false)).toBe(false);
    expect(isIpadUserAgent(UA.desktopMacSafari, true)).toBe(true);
  });

  it("does NOT match iPhone UAs even when touch is available (regression: 'like Mac OS X')", () => {
    // iPhone UAs contain the substring "Mac" inside "like Mac OS X" and real
    // iPhones expose ontouchend, so a naive `ua.includes("Mac") && touch`
    // check would misclassify them as iPads. Guard against that here.
    expect(isIpadUserAgent(UA.iphoneIos17, true)).toBe(false);
    expect(isIpadUserAgent(UA.iphoneIos15, true)).toBe(false);
    expect(isIpadUserAgent(UA.iphoneIos14, true)).toBe(false);
    expect(isIpadUserAgent(UA.iphoneIos12, true)).toBe(false);
  });
});

describe("isIosUserAgent", () => {
  it("recognizes iPhone, iPad, and iPadOS-as-Mac (with touch)", () => {
    expect(isIosUserAgent(UA.iphoneIos17, true)).toBe(true);
    expect(isIosUserAgent(UA.ipadLegacy, false)).toBe(true);
    expect(isIosUserAgent(UA.ipadDesktopMode, true)).toBe(true);
  });

  it("rejects desktop Safari (no touch) and Android UAs", () => {
    expect(isIosUserAgent(UA.desktopMacSafari, false)).toBe(false);
    expect(isIosUserAgent(UA.androidChrome, false)).toBe(false);
    expect(isIosUserAgent(UA.androidChrome, true)).toBe(false);
  });
});

describe("pickIosShareLocation", () => {
  it("returns 'top' for iPad regardless of iPadOS version or touch flag", () => {
    expect(pickIosShareLocation(UA.ipadLegacy, false)).toBe("top");
    expect(pickIosShareLocation(UA.ipadLegacy, true)).toBe("top");
    expect(pickIosShareLocation(UA.ipadDesktopMode, true)).toBe("top");
  });

  it("returns 'top' for iPhone on iOS 15+ (newer Safari layout) with realistic touch=true", () => {
    expect(pickIosShareLocation(UA.iphoneIos17, true)).toBe("top");
    expect(pickIosShareLocation(UA.iphoneIos15, true)).toBe("top");
  });

  it("returns 'bottom' for iPhone on iOS 14 and earlier (older Safari layout) with realistic touch=true", () => {
    // These are the regression cases the previous implementation got wrong:
    // an iPhone with touch must NOT be treated like an iPad and must keep
    // the bottom-arrow behavior on older iOS.
    expect(pickIosShareLocation(UA.iphoneIos14, true)).toBe("bottom");
    expect(pickIosShareLocation(UA.iphoneIos12, true)).toBe("bottom");
  });

  it("falls back to 'bottom' when version cannot be determined", () => {
    expect(
      pickIosShareLocation("Mozilla/5.0 unknown iPhone-like", true),
    ).toBe("bottom");
  });
});
