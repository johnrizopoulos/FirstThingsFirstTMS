import { describe, it, expect } from "vitest";
import {
  detectRateLimit,
  formatCountdown,
  describeError,
  sanitizeSignInError,
  sanitizeResetPasswordError,
  isIdentifierNotFoundError,
} from "../clerkRateLimit";

const DEFAULT_COOLDOWN_SECONDS = 5 * 60;

describe("detectRateLimit", () => {
  it("returns not limited for null/undefined/non-object inputs", () => {
    expect(detectRateLimit(null)).toEqual({ limited: false, retryAfterSeconds: 0 });
    expect(detectRateLimit(undefined)).toEqual({ limited: false, retryAfterSeconds: 0 });
    expect(detectRateLimit("oops")).toEqual({ limited: false, retryAfterSeconds: 0 });
    expect(detectRateLimit(42)).toEqual({ limited: false, retryAfterSeconds: 0 });
  });

  it("returns not limited when no matching code or status is present", () => {
    expect(
      detectRateLimit({
        status: 400,
        errors: [{ code: "form_password_incorrect", message: "wrong" }],
      }),
    ).toEqual({ limited: false, retryAfterSeconds: 0 });
  });

  it("detects user_locked code from errors[]", () => {
    const result = detectRateLimit({
      errors: [{ code: "user_locked", message: "Account locked" }],
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(DEFAULT_COOLDOWN_SECONDS);
  });

  it("detects too_many_requests code from errors[]", () => {
    const result = detectRateLimit({
      errors: [{ code: "too_many_requests", message: "slow down" }],
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(DEFAULT_COOLDOWN_SECONDS);
  });

  it("detects generic codes containing 'lockout' substring", () => {
    const result = detectRateLimit({
      errors: [{ code: "user_lockout_in_effect", message: "Locked" }],
    });
    expect(result.limited).toBe(true);
  });

  it("detects generic codes containing 'rate_limit' substring", () => {
    const result = detectRateLimit({
      errors: [{ code: "signup_rate_limit_hit", message: "Too many signups" }],
    });
    expect(result.limited).toBe(true);
  });

  it("detects generic codes containing 'too_many' substring", () => {
    const result = detectRateLimit({
      errors: [{ code: "too_many_attempts_today", message: "Too many" }],
    });
    expect(result.limited).toBe(true);
  });

  it("matches codes case-insensitively", () => {
    const result = detectRateLimit({
      errors: [{ code: "USER_LOCKED", message: "Locked" }],
    });
    expect(result.limited).toBe(true);
  });

  it("detects HTTP 429 even when no code is present", () => {
    const result = detectRateLimit({
      status: 429,
      errors: [{ message: "Too many requests" }],
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(DEFAULT_COOLDOWN_SECONDS);
  });

  it("detects HTTP 429 with no errors array at all", () => {
    const result = detectRateLimit({ status: 429 });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(DEFAULT_COOLDOWN_SECONDS);
  });

  it("falls back to top-level code when errors[] is empty", () => {
    const result = detectRateLimit({
      code: "user_locked",
      message: "Locked",
    });
    expect(result.limited).toBe(true);
  });

  it("uses top-level retryAfter when provided", () => {
    const result = detectRateLimit({
      status: 429,
      retryAfter: 90,
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(90);
  });

  it("uses meta.retryAfter from errors[] entries", () => {
    const result = detectRateLimit({
      errors: [
        {
          code: "user_locked",
          message: "Locked",
          meta: { retryAfter: 120 },
        },
      ],
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(120);
  });

  it("uses meta.retry_after (snake_case) variant", () => {
    const result = detectRateLimit({
      errors: [
        {
          code: "user_locked",
          message: "Locked",
          meta: { retry_after: 200 },
        },
      ],
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(200);
  });

  it("uses meta.retryAfterSeconds variant", () => {
    const result = detectRateLimit({
      errors: [
        {
          code: "user_locked",
          message: "Locked",
          meta: { retryAfterSeconds: 45 },
        },
      ],
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(45);
  });

  it("prefers top-level retryAfter over meta values", () => {
    const result = detectRateLimit({
      status: 429,
      retryAfter: 30,
      errors: [
        {
          code: "user_locked",
          meta: { retryAfter: 600 },
        },
      ],
    });
    expect(result.retryAfterSeconds).toBe(30);
  });

  it("scans subsequent error entries when earlier entries lack meta", () => {
    const result = detectRateLimit({
      errors: [
        { code: "user_locked", message: "Locked" },
        { code: "too_many_requests", meta: { retryAfter: 75 } },
      ],
    });
    expect(result.retryAfterSeconds).toBe(75);
  });

  it("uses 5-minute fallback when retry-after is missing", () => {
    const result = detectRateLimit({
      errors: [{ code: "user_locked", message: "Locked" }],
    });
    expect(result.retryAfterSeconds).toBe(DEFAULT_COOLDOWN_SECONDS);
  });

  it("uses 5-minute fallback when retry-after is negative", () => {
    const result = detectRateLimit({
      status: 429,
      retryAfter: -10,
    });
    expect(result.retryAfterSeconds).toBe(DEFAULT_COOLDOWN_SECONDS);
  });

  it("uses 5-minute fallback when retry-after is zero", () => {
    const result = detectRateLimit({
      status: 429,
      retryAfter: 0,
    });
    expect(result.retryAfterSeconds).toBe(DEFAULT_COOLDOWN_SECONDS);
  });
});

describe("formatCountdown", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatCountdown(45)).toBe("45 seconds");
    expect(formatCountdown(30)).toBe("30 seconds");
  });

  it("uses singular 'second' for 1 second", () => {
    expect(formatCountdown(1)).toBe("1 second");
  });

  it("uses plural 'seconds' for 0 seconds", () => {
    expect(formatCountdown(0)).toBe("0 seconds");
  });

  it("clamps negative input to 0 seconds", () => {
    expect(formatCountdown(-5)).toBe("0 seconds");
  });

  it("rounds fractional seconds up", () => {
    expect(formatCountdown(12.1)).toBe("13 seconds");
  });

  it("formats exact-minute durations", () => {
    expect(formatCountdown(60)).toBe("1 minute");
    expect(formatCountdown(120)).toBe("2 minutes");
    expect(formatCountdown(300)).toBe("5 minutes");
  });

  it("uses singular 'minute' for 1 minute", () => {
    expect(formatCountdown(60)).toBe("1 minute");
  });

  it("formats mixed minute+second durations with zero-padded seconds", () => {
    expect(formatCountdown(65)).toBe("1m 05s");
    expect(formatCountdown(75)).toBe("1m 15s");
    expect(formatCountdown(125)).toBe("2m 05s");
    expect(formatCountdown(3599)).toBe("59m 59s");
  });
});

describe("describeError", () => {
  it("returns a generic message for null/undefined", () => {
    expect(describeError(null)).toBe("Something went wrong. Please try again.");
    expect(describeError(undefined)).toBe("Something went wrong. Please try again.");
  });

  it("returns the message of a plain Error instance", () => {
    expect(describeError(new Error("Boom"))).toBe("Boom");
  });

  it("prefers errors[0].longMessage when present", () => {
    expect(
      describeError({
        errors: [
          {
            code: "user_locked",
            message: "Short",
            longMessage: "Long detailed reason",
          },
        ],
      }),
    ).toBe("Long detailed reason");
  });

  it("falls back to errors[0].message when longMessage is missing", () => {
    expect(
      describeError({
        errors: [{ code: "user_locked", message: "Short" }],
      }),
    ).toBe("Short");
  });

  it("falls back to top-level longMessage / message when errors is empty", () => {
    expect(
      describeError({
        longMessage: "Top long",
        message: "Top short",
      }),
    ).toBe("Top long");
    expect(
      describeError({
        message: "Top short",
      }),
    ).toBe("Top short");
  });

  it("returns generic fallback when no message can be found", () => {
    expect(describeError({})).toBe("Something went wrong. Please try again.");
  });
});

describe("sanitizeSignInError", () => {
  it("returns generic credential message for form_identifier_not_found", () => {
    expect(
      sanitizeSignInError({ errors: [{ code: "form_identifier_not_found", message: "Email not found" }] }),
    ).toBe("Invalid email or password.");
  });

  it("returns generic credential message for form_password_incorrect", () => {
    expect(
      sanitizeSignInError({ errors: [{ code: "form_password_incorrect", message: "Bad password" }] }),
    ).toBe("Invalid email or password.");
  });

  it("returns generic credential message for unknown enumeration codes", () => {
    expect(
      sanitizeSignInError({ errors: [{ code: "strategy_for_user_invalid", message: "x" }] }),
    ).toBe("Invalid email or password.");
  });

  it("returns generic credential message when no code is present", () => {
    expect(sanitizeSignInError({ errors: [{ message: "Some error" }] })).toBe(
      "Invalid email or password.",
    );
  });

  it("returns generic fallback for non-Clerk errors", () => {
    expect(sanitizeSignInError(null)).toBe("Something went wrong. Please try again.");
    expect(sanitizeSignInError(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });

  it("does not expose raw Clerk message text", () => {
    const clerkError = {
      errors: [{ code: "form_identifier_not_found", longMessage: "The email address is not found." }],
    };
    expect(sanitizeSignInError(clerkError)).not.toContain("not found");
    expect(sanitizeSignInError(clerkError)).not.toContain("email address");
  });
});

describe("sanitizeResetPasswordError", () => {
  it("always returns the generic error message regardless of error content", () => {
    expect(sanitizeResetPasswordError(null)).toBe("Something went wrong. Please try again.");
    expect(sanitizeResetPasswordError({ errors: [{ code: "form_identifier_not_found" }] })).toBe(
      "Something went wrong. Please try again.",
    );
    expect(sanitizeResetPasswordError({ errors: [{ code: "form_password_incorrect" }] })).toBe(
      "Something went wrong. Please try again.",
    );
    expect(sanitizeResetPasswordError(new Error("Network error"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("isIdentifierNotFoundError", () => {
  it("returns true for form_identifier_not_found in errors[]", () => {
    expect(
      isIdentifierNotFoundError({ errors: [{ code: "form_identifier_not_found" }] }),
    ).toBe(true);
  });

  it("returns true for form_identifier_not_found at top level", () => {
    expect(isIdentifierNotFoundError({ code: "form_identifier_not_found" })).toBe(true);
  });

  it("returns false for form_password_incorrect (wrong password, known account)", () => {
    expect(
      isIdentifierNotFoundError({ errors: [{ code: "form_password_incorrect" }] }),
    ).toBe(false);
  });

  it("returns false for other Clerk error codes", () => {
    expect(
      isIdentifierNotFoundError({ errors: [{ code: "user_locked" }] }),
    ).toBe(false);
    expect(
      isIdentifierNotFoundError({ errors: [{ code: "too_many_requests" }] }),
    ).toBe(false);
  });

  it("returns false for null/undefined/non-object inputs", () => {
    expect(isIdentifierNotFoundError(null)).toBe(false);
    expect(isIdentifierNotFoundError(undefined)).toBe(false);
    expect(isIdentifierNotFoundError("string")).toBe(false);
  });

  it("returns false for errors with no code", () => {
    expect(isIdentifierNotFoundError({ errors: [{ message: "some error" }] })).toBe(false);
  });
});
