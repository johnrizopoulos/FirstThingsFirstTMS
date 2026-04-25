import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isOnline,
  isNetworkLikeError,
  reportNetworkError,
  clearNetworkError,
  subscribeOnlineStatus,
  installOnlineStatusBridge,
  __resetOnlineStatusForTests,
} from "../onlineStatus";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: value },
    configurable: true,
  });
}

interface FakeWindow {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  dispatchEvent: (type: string) => void;
}

function makeFakeWindow(): FakeWindow {
  const handlers = new Map<string, Set<() => void>>();
  return {
    addEventListener(type, listener) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      handlers.get(type)?.delete(listener);
    },
    dispatchEvent(type) {
      handlers.get(type)?.forEach((fn) => fn());
    },
  };
}

function withFakeWindow(run: () => void) {
  const previous = (globalThis as { window?: unknown }).window;
  const fake = makeFakeWindow();
  Object.defineProperty(globalThis, "window", {
    value: fake,
    configurable: true,
  });
  try {
    run();
  } finally {
    if (previous === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", {
        value: previous,
        configurable: true,
      });
    }
  }
}

describe("onlineStatus", () => {
  beforeEach(() => {
    __resetOnlineStatusForTests();
    setNavigatorOnline(true);
    vi.useRealTimers();
  });

  describe("isOnline", () => {
    it("returns true when navigator.onLine is true and no network errors", () => {
      setNavigatorOnline(true);
      expect(isOnline()).toBe(true);
    });

    it("returns false when navigator.onLine is false", () => {
      setNavigatorOnline(false);
      expect(isOnline()).toBe(false);
    });

    it("returns true when navigator is undefined (SSR)", () => {
      const previous = (globalThis as { navigator?: unknown }).navigator;
      // @ts-expect-error - intentionally removing navigator to simulate SSR
      delete (globalThis as { navigator?: unknown }).navigator;
      try {
        expect(isOnline()).toBe(true);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: previous,
          configurable: true,
        });
      }
    });

    it("returns false within the grace window after a reported network error", () => {
      setNavigatorOnline(true);
      reportNetworkError(1000);
      expect(isOnline(1500)).toBe(false);
    });

    it("returns true again after the grace window elapses", () => {
      setNavigatorOnline(true);
      reportNetworkError(1000);
      expect(isOnline(1000 + 8001)).toBe(true);
    });

    it("clearNetworkError immediately restores online state", () => {
      setNavigatorOnline(true);
      reportNetworkError(1000);
      expect(isOnline(1500)).toBe(false);
      clearNetworkError();
      expect(isOnline(1500)).toBe(true);
    });
  });

  describe("isNetworkLikeError", () => {
    it("recognises TypeError as a network error", () => {
      expect(isNetworkLikeError(new TypeError("Failed to fetch"))).toBe(true);
    });

    it("recognises 'failed to fetch' messages regardless of case", () => {
      expect(isNetworkLikeError(new Error("Failed to fetch"))).toBe(true);
      expect(isNetworkLikeError(new Error("failed to fetch"))).toBe(true);
    });

    it("recognises common cross-browser network error phrases", () => {
      expect(isNetworkLikeError(new Error("Network request failed"))).toBe(true);
      expect(isNetworkLikeError(new Error("Load failed"))).toBe(true);
      expect(isNetworkLikeError(new Error("NetworkError when attempting to fetch resource."))).toBe(true);
    });

    it("does not flag non-network errors", () => {
      expect(isNetworkLikeError(new Error("500: server exploded"))).toBe(false);
      expect(isNetworkLikeError(new Error("401: unauthorized"))).toBe(false);
    });

    it("returns false for null/undefined/non-objects", () => {
      expect(isNetworkLikeError(null)).toBe(false);
      expect(isNetworkLikeError(undefined)).toBe(false);
      expect(isNetworkLikeError("oops")).toBe(false);
      expect(isNetworkLikeError(42)).toBe(false);
    });
  });

  describe("subscribeOnlineStatus", () => {
    it("notifies listeners when reportNetworkError is called", () => {
      setNavigatorOnline(true);
      const listener = vi.fn();
      const unsubscribe = subscribeOnlineStatus(listener);
      reportNetworkError();
      expect(listener).toHaveBeenCalledWith(false);
      unsubscribe();
    });

    it("notifies listeners when clearNetworkError flips state back online", () => {
      setNavigatorOnline(true);
      const listener = vi.fn();
      reportNetworkError();
      const unsubscribe = subscribeOnlineStatus(listener);
      clearNetworkError();
      expect(listener).toHaveBeenLastCalledWith(true);
      unsubscribe();
    });

    it("clearNetworkError is a no-op when no error was reported", () => {
      setNavigatorOnline(true);
      const listener = vi.fn();
      const unsubscribe = subscribeOnlineStatus(listener);
      clearNetworkError();
      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });

    it("unsubscribe removes the listener", () => {
      setNavigatorOnline(true);
      const listener = vi.fn();
      const unsubscribe = subscribeOnlineStatus(listener);
      unsubscribe();
      reportNetworkError();
      expect(listener).not.toHaveBeenCalled();
    });

    it("installOnlineStatusBridge ref-counts so multiple consumers can mount and unmount independently", () => {
      withFakeWindow(() => {
        const listener = vi.fn();
        subscribeOnlineStatus(listener);

        const release1 = installOnlineStatusBridge();
        const release2 = installOnlineStatusBridge();

        // First consumer releases — listeners should still fire because consumer 2 is still mounted.
        release1();
        setNavigatorOnline(false);
        (globalThis as unknown as { window: FakeWindow }).window.dispatchEvent("offline");
        expect(listener).toHaveBeenCalledWith(false);

        listener.mockClear();
        release2();
        // Now bridge is fully torn down — events should no longer reach listeners.
        setNavigatorOnline(true);
        (globalThis as unknown as { window: FakeWindow }).window.dispatchEvent("online");
        expect(listener).not.toHaveBeenCalled();
      });
    });

    it("calling the same release function twice does not under-flow the ref count", () => {
      withFakeWindow(() => {
        const listener = vi.fn();
        subscribeOnlineStatus(listener);

        const release1 = installOnlineStatusBridge();
        const release2 = installOnlineStatusBridge();
        release1();
        release1(); // double-release — should be a no-op

        setNavigatorOnline(false);
        (globalThis as unknown as { window: FakeWindow }).window.dispatchEvent("offline");
        expect(listener).toHaveBeenCalledWith(false);
        release2();
      });
    });

    it("isolates listener errors so other listeners still fire", () => {
      setNavigatorOnline(true);
      const bad = vi.fn(() => {
        throw new Error("listener exploded");
      });
      const good = vi.fn();
      subscribeOnlineStatus(bad);
      subscribeOnlineStatus(good);
      reportNetworkError();
      expect(bad).toHaveBeenCalled();
      expect(good).toHaveBeenCalledWith(false);
    });
  });
});
