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

const queueState = vi.hoisted(() => {
  type QueueListener = (event: unknown) => void;
  const listeners = new Set<QueueListener>();
  const state: {
    snapshot: Array<{
      id: string;
      op: string;
      args: unknown[];
      enqueuedAt: number;
    }>;
    listeners: Set<QueueListener>;
  } = { snapshot: [], listeners };
  return state;
});

function setMockQueue(
  next: Array<{ id: string; op: string; args: unknown[]; enqueuedAt?: number }>,
) {
  queueState.snapshot = next.map((entry) => ({
    enqueuedAt: 0,
    ...entry,
  }));
}

function emitQueueEvent(event: unknown) {
  queueState.listeners.forEach((l) => l(event));
}

vi.mock("@/lib/offlineQueue", () => ({
  drainQueue: vi.fn(async () => {}),
  registerHandlers: vi.fn(),
  startQueueBridge: vi.fn(() => () => {}),
  subscribeQueue: vi.fn((listener: (event: unknown) => void) => {
    queueState.listeners.add(listener);
    return () => {
      queueState.listeners.delete(listener);
    };
  }),
  syncQueueOwner: vi.fn(),
  getQueueSize: vi.fn(() => queueState.snapshot.length),
  getQueueSnapshot: vi.fn(() => queueState.snapshot.slice()),
}));

vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(async () => {}),
    getQueryData: vi.fn(() => undefined),
  },
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
    setMockQueue([]);
    queueState.listeners.clear();
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

  it("shows a pending count badge when there are queued changes while offline", () => {
    setNavigatorOnline(false);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Foo" }] },
      { id: "b", op: "completeTask", args: ["task-1"] },
      { id: "c", op: "deleteMilestone", args: ["m-1"] },
    ]);
    render(<OfflineBanner />);

    expect(screen.getByTestId("banner-offline")).toBeTruthy();
    expect(screen.getByTestId("text-pending-count").textContent).toContain("3");
  });

  it("does not render a badge when the queue is empty", () => {
    setNavigatorOnline(false);
    setMockQueue([]);
    render(<OfflineBanner />);

    expect(screen.getByTestId("banner-offline")).toBeTruthy();
    expect(screen.queryByTestId("button-pending-changes")).toBeNull();
    expect(screen.queryByTestId("text-pending-count")).toBeNull();
  });

  it("toggles a details panel listing the queued operations", () => {
    setNavigatorOnline(false);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Buy milk" }] },
      { id: "b", op: "completeTask", args: ["task-1"] },
    ]);
    render(<OfflineBanner />);

    expect(screen.queryByTestId("panel-pending-changes")).toBeNull();

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    const panel = screen.getByTestId("panel-pending-changes");
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain("create task: Buy milk");
    expect(panel.textContent).toContain("complete task");

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });
    expect(screen.queryByTestId("panel-pending-changes")).toBeNull();
  });

  it("updates the pending count as queue events fire", () => {
    setNavigatorOnline(false);
    setMockQueue([{ id: "a", op: "createTask", args: [{ title: "Foo" }] }]);
    render(<OfflineBanner />);

    expect(screen.getByTestId("text-pending-count").textContent).toContain("1");

    act(() => {
      setMockQueue([
        { id: "a", op: "createTask", args: [{ title: "Foo" }] },
        { id: "b", op: "createTask", args: [{ title: "Bar" }] },
      ]);
      emitQueueEvent({ type: "queued", op: "createTask", size: 2 });
    });

    expect(screen.getByTestId("text-pending-count").textContent).toContain("2");

    act(() => {
      setMockQueue([]);
      emitQueueEvent({ type: "drained", processed: 2, remaining: 0 });
    });

    expect(screen.queryByTestId("text-pending-count")).toBeNull();
    expect(screen.queryByTestId("button-pending-changes")).toBeNull();
  });

  it("collapses overflow entries with a +N more line", () => {
    setNavigatorOnline(false);
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      op: "createTask",
      args: [{ title: `Task ${i}` }],
    }));
    setMockQueue(entries);
    render(<OfflineBanner />);

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    expect(screen.getByTestId("text-pending-overflow").textContent).toContain(
      "+2 more",
    );
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
