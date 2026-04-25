// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  __resetOnlineStatusForTests,
  clearNetworkError,
  reportNetworkError,
} from "@/lib/onlineStatus";

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: null, isLoaded: true }),
}));

vi.mock("@/lib/offlineQueue", () => ({
  drainQueue: vi.fn(async () => {}),
  registerHandlers: vi.fn(),
  startQueueBridge: vi.fn(() => () => {}),
  subscribeQueue: vi.fn(() => () => {}),
  syncQueueOwner: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn(async () => {}) },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  rawMutations: {},
}));

import { OfflineBanner } from "../OfflineBanner";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value,
    configurable: true,
    writable: true,
  });
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    __resetOnlineStatusForTests();
    setNavigatorOnline(true);
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    clearNetworkError();
    __resetOnlineStatusForTests();
  });

  it("renders nothing when the browser is online and no error is reported", () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByTestId("banner-offline")).toBeNull();
    expect(screen.queryByTestId("banner-reconnected")).toBeNull();
  });

  it("shows the offline banner when navigator.onLine is false on mount", () => {
    setNavigatorOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByTestId("banner-offline");
    expect(banner).toBeTruthy();
    expect(screen.getByTestId("text-offline-message").textContent).toContain(
      "OFFLINE",
    );
  });

  it("shows the offline banner when reportNetworkError is called while mounted", () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByTestId("banner-offline")).toBeNull();

    act(() => {
      reportNetworkError();
    });

    expect(screen.getByTestId("banner-offline")).toBeTruthy();
  });

  it("shows the reconnected confirmation after coming back online and auto-hides it ~2.5s later", () => {
    vi.useFakeTimers();
    setNavigatorOnline(false);
    render(<OfflineBanner />);

    expect(screen.getByTestId("banner-offline")).toBeTruthy();

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    const reconnected = screen.getByTestId("banner-reconnected");
    expect(reconnected).toBeTruthy();
    expect(
      screen.getByTestId("text-reconnected-message").textContent,
    ).toContain("RECONNECTED");

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.queryByTestId("banner-reconnected")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId("banner-reconnected")).toBeNull();
    expect(screen.queryByTestId("banner-offline")).toBeNull();
  });

  it("hides the offline banner immediately when clearNetworkError is called", () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);

    act(() => {
      reportNetworkError();
    });
    expect(screen.getByTestId("banner-offline")).toBeTruthy();

    act(() => {
      clearNetworkError();
    });

    // After clearing the network error, we transition to "reconnected" briefly
    // (the banner remains visible but switches to the reconnected variant).
    expect(screen.queryByTestId("banner-offline")).toBeNull();
    expect(screen.getByTestId("banner-reconnected")).toBeTruthy();
  });
});
