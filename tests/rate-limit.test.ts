import { describe, it, expect } from "vitest";
import { rateLimit } from "../src/lib/security/rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const limit = 3;
    const windowMs = 60_000;
    expect(rateLimit(key, limit, windowMs).allowed).toBe(true);
    expect(rateLimit(key, limit, windowMs).allowed).toBe(true);
    expect(rateLimit(key, limit, windowMs).allowed).toBe(true);
    const blocked = rateLimit(key, limit, windowMs);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
