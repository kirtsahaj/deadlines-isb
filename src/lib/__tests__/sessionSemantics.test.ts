import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ordinary sign-out", () => {
  it("ends only the browser session and never purges account-scoped data", () => {
    const settings = readFileSync("src/routes/_authenticated/settings.tsx", "utf8");
    const start = settings.indexOf("async function signOut()");
    const end = settings.indexOf("\n  }", start);
    const implementation = settings.slice(start, end);
    expect(implementation).toContain("supabase.auth.signOut()");
    expect(implementation).not.toContain("purgeUserData");
    expect(implementation).not.toContain("disconnectElearn");
    expect(implementation).not.toContain("deleteAccount");
  });
});
