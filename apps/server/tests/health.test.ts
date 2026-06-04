import { describe, expect, it } from "bun:test";
import { health } from "@/routes/health";

describe("health", () => {
  it("returns ok", async () => {
    const res = await health.request("/");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
