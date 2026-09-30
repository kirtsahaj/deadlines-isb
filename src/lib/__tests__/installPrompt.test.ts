import { describe, expect, it } from "vitest";
import { INSTALL_DISMISSED_KEY, INSTALL_READY_KEY, shouldShowInstallPrompt } from "../installPrompt";

function storage(values: Record<string, string>) {
  return { getItem: (key: string) => values[key] ?? null };
}

describe("install prompt", () => {
  it("appears only after setup is ready", () => {
    expect(shouldShowInstallPrompt(storage({ [INSTALL_READY_KEY]: "true" }) as Storage)).toBe(true);
    expect(shouldShowInstallPrompt(storage({}) as Storage)).toBe(false);
  });

  it("does not return after dismissal", () => {
    expect(shouldShowInstallPrompt(storage({ [INSTALL_READY_KEY]: "true", [INSTALL_DISMISSED_KEY]: "true" }) as Storage)).toBe(false);
  });
});