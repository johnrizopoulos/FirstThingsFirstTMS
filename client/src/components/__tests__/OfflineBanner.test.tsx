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

const queueMutations = vi.hoisted(() => ({
  removeQueueEntry: vi.fn(),
  retryQueueEntry: vi.fn(),
  insertQueueEntry: vi.fn(),
}));

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
  removeQueueEntry: queueMutations.removeQueueEntry,
  retryQueueEntry: queueMutations.retryQueueEntry,
  insertQueueEntry: queueMutations.insertQueueEntry,
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
import { toast } from "@/hooks/use-toast";

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
    vi.mocked(toast).mockClear();
    queueMutations.removeQueueEntry.mockReset();
    queueMutations.retryQueueEntry.mockReset();
    queueMutations.insertQueueEntry.mockReset();
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

  it("prefers the stored label over the cache lookup so the panel reads correctly after a cold reload", () => {
    // Simulate a cold reload: the React Query cache is empty (queryClient
    // mock returns undefined) but the queued entry carries a label captured
    // at enqueue time. The panel must surface the label, not a bare op name.
    setNavigatorOnline(false);
    setMockQueue([
      {
        id: "a",
        op: "completeTask",
        args: ["task-real-id"],
        label: "Buy milk",
      },
    ]);
    render(<OfflineBanner />);

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    const panel = screen.getByTestId("panel-pending-changes");
    expect(panel.textContent).toContain("complete task: Buy milk");
  });

  it("falls back to the bare op name for legacy entries without a label when the cache is cold", () => {
    // Older queued entries persisted before the label feature won't have a
    // `label` field. With an empty cache they should still render without
    // crashing — just without a friendly title.
    setNavigatorOnline(false);
    setMockQueue([
      { id: "a", op: "completeTask", args: ["task-1"] },
    ]);
    render(<OfflineBanner />);

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    const panel = screen.getByTestId("panel-pending-changes");
    expect(panel.textContent).toContain("complete task");
    expect(panel.textContent).not.toContain(":");
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

  it("shows a destructive toast when a queued change conflicts with the server", () => {
    setNavigatorOnline(false);
    render(<OfflineBanner />);

    act(() => {
      emitQueueEvent({
        type: "conflict",
        op: "createTask",
        error: new Error("not found"),
      });
    });

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Couldn't sync a saved change",
        description: expect.stringContaining("create task"),
      }),
    );
    const call = vi.mocked(toast).mock.calls[0]?.[0] as
      | { description?: string }
      | undefined;
    expect(call?.description).toContain("no longer exists");
  });

  it("shows a destructive toast when a queued change errors on reconnect", () => {
    setNavigatorOnline(false);
    render(<OfflineBanner />);

    act(() => {
      emitQueueEvent({
        type: "error",
        op: "updateTask",
        error: new Error("boom"),
      });
    });

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Couldn't sync a saved change",
        description: expect.stringContaining("update task"),
      }),
    );
    const call = vi.mocked(toast).mock.calls[0]?.[0] as
      | { description?: string }
      | undefined;
    expect(call?.description).toContain("after reconnecting");
  });

  it("renders per-row discard and retry controls in the pending changes panel", () => {
    setNavigatorOnline(false);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Buy milk" }] },
      { id: "b", op: "completeTask", args: ["task-1"] },
    ]);
    render(<OfflineBanner />);

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    expect(screen.getByTestId("button-discard-pending-a")).toBeTruthy();
    expect(screen.getByTestId("button-retry-pending-a")).toBeTruthy();
    expect(screen.getByTestId("button-discard-pending-b")).toBeTruthy();
    expect(screen.getByTestId("button-retry-pending-b")).toBeTruthy();
  });

  it("disables retry buttons while the browser is offline", () => {
    setNavigatorOnline(false);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Buy milk" }] },
    ]);
    render(<OfflineBanner />);

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    const retry = screen.getByTestId(
      "button-retry-pending-a",
    ) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
  });

  it("calls removeQueueEntry on discard and offers an undo toast that re-inserts at the original index", () => {
    setNavigatorOnline(false);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Buy milk" }] },
      { id: "b", op: "createTask", args: [{ title: "Eggs" }] },
    ]);
    const removedEntry = {
      id: "b",
      op: "createTask" as const,
      args: [{ title: "Eggs" }],
      enqueuedAt: 0,
    };
    queueMutations.removeQueueEntry.mockReturnValue({
      entry: removedEntry,
      index: 1,
    });
    render(<OfflineBanner />);

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    act(() => {
      screen.getByTestId("button-discard-pending-b").click();
    });

    expect(queueMutations.removeQueueEntry).toHaveBeenCalledWith("b");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Discarded queued change",
        description: expect.stringContaining("Eggs"),
        action: expect.anything(),
      }),
    );

    // Trigger the undo action passed to the toast.
    const toastCall = vi.mocked(toast).mock.calls.at(-1)?.[0] as {
      action?: { props?: { onClick?: () => void } };
    };
    act(() => {
      toastCall.action?.props?.onClick?.();
    });

    expect(queueMutations.insertQueueEntry).toHaveBeenCalledWith(
      removedEntry,
      1,
    );
  });

  it("does nothing when the snapshot is stale and removeQueueEntry returns null", () => {
    setNavigatorOnline(false);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Buy milk" }] },
    ]);
    queueMutations.removeQueueEntry.mockReturnValue(null);
    render(<OfflineBanner />);

    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });
    act(() => {
      screen.getByTestId("button-discard-pending-a").click();
    });

    expect(queueMutations.removeQueueEntry).toHaveBeenCalledWith("a");
    expect(toast).not.toHaveBeenCalled();
  });

  it("calls retryQueueEntry on retry and toasts success when it resolves", async () => {
    setNavigatorOnline(true);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Buy milk" }] },
    ]);
    // Force the banner to render by being mid-reconnect.
    queueMutations.retryQueueEntry.mockResolvedValue({ status: "success" });
    render(<OfflineBanner />);

    act(() => {
      reportNetworkError();
    });
    act(() => {
      clearNetworkError();
    });
    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    await act(async () => {
      screen.getByTestId("button-retry-pending-a").click();
    });

    expect(queueMutations.retryQueueEntry).toHaveBeenCalledWith("a");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Synced queued change",
        description: expect.stringContaining("Buy milk"),
      }),
    );
  });

  it("toasts a destructive message when retry reports a network failure", async () => {
    setNavigatorOnline(true);
    setMockQueue([
      { id: "a", op: "createTask", args: [{ title: "Buy milk" }] },
    ]);
    queueMutations.retryQueueEntry.mockResolvedValue({
      status: "network",
      error: new TypeError("Failed to fetch"),
    });
    render(<OfflineBanner />);

    act(() => {
      reportNetworkError();
    });
    act(() => {
      clearNetworkError();
    });
    act(() => {
      screen.getByTestId("button-pending-changes").click();
    });

    await act(async () => {
      screen.getByTestId("button-retry-pending-a").click();
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Couldn't reach the server",
      }),
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
