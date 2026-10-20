import { describe, expect, it, vi } from "vitest";
import { connectFromClipboard } from "../connectFromClipboard";

describe("explicit clipboard connection", () => {
  const token = "a".repeat(32);
  const link = `moodlemobile://token=${btoa(`passport:::${token}:::private-autologin`)}`;

  it("reads on invocation and sends only the validated REST token", async () => {
    const readText = vi.fn().mockResolvedValue(link);
    const connect = vi.fn().mockResolvedValue({ connected: true });
    expect(readText).not.toHaveBeenCalled();
    expect(await connectFromClipboard({ readText }, connect)).toEqual({ kind: "connected", result: { connected: true } });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledExactlyOnceWith(token);
  });

  it("offers manual paste if permission is denied without connecting", async () => {
    const connect = vi.fn();
    expect(await connectFromClipboard({ readText: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")) }, connect)).toEqual({ kind: "manual" });
    expect(connect).not.toHaveBeenCalled();
  });

  it("offers manual paste when clipboard access is unavailable", async () => {
    const connect = vi.fn();
    expect(await connectFromClipboard(undefined, connect)).toEqual({ kind: "manual" });
    expect(connect).not.toHaveBeenCalled();
  });

  it("rejects unrelated clipboard text before any connection request", async () => {
    const connect = vi.fn();
    await expect(connectFromClipboard({ readText: vi.fn().mockResolvedValue("https://elearn.isb.edu/") }, connect)).rejects.toThrow("invalid_connection_code");
    expect(connect).not.toHaveBeenCalled();
  });
});