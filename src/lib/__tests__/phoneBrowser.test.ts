import { describe, expect, it } from "vitest";
import { chromeOpenUrl, detectPhoneBrowser } from "../phoneBrowser";

describe("Chrome-first phone setup", () => {
  it("directs iPhone Safari to Chrome rather than treating it as tested Chrome", () => {
    expect(detectPhoneBrowser("Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1")).toEqual({ platform: "ios", chrome: false });
    expect(detectPhoneBrowser("Mozilla/5.0 (iPhone) CriOS/140.0 Mobile Safari/604.1")).toEqual({ platform: "ios", chrome: true });
  });
  it("recognizes iPad desktop-mode browsing and leaves desktop unchanged", () => {
    expect(detectPhoneBrowser("Mozilla/5.0 (Macintosh) Safari/605.1", 5)?.platform).toBe("ios");
    expect(detectPhoneBrowser("Mozilla/5.0 (Macintosh) Chrome/140.0", 0)).toBeNull();
  });
  it("distinguishes Android Chrome from other Android browsers", () => {
    expect(detectPhoneBrowser("Mozilla/5.0 (Android) Chrome/140.0")).toEqual({ platform: "android", chrome: true });
    expect(detectPhoneBrowser("Mozilla/5.0 (Android) Chrome/140.0 SamsungBrowser/28.0")?.chrome).toBe(false);
  });
  it("opens HTTPS tracker and fresh setup addresses using Chrome's iOS scheme", () => {
    expect(chromeOpenUrl("https://deadlines-isb.lovable.app/connect", "ios")).toBe("googlechromes://deadlines-isb.lovable.app/connect");
    expect(chromeOpenUrl("https://elearn.isb.edu/admin/tool/mobile/launch.php?passport=123&confirmed=1", "ios")).toBe("googlechromes://elearn.isb.edu/admin/tool/mobile/launch.php?passport=123&confirmed=1");
  });
  it("targets the Chrome app on Android without accepting insecure addresses", () => {
    expect(chromeOpenUrl("https://elearn.isb.edu/admin/tool/mobile/launch.php?passport=123", "android")).toBe("intent://elearn.isb.edu/admin/tool/mobile/launch.php?passport=123#Intent;scheme=https;package=com.android.chrome;end");
    expect(() => chromeOpenUrl("javascript:alert(1)", "ios")).toThrow("https_required");
  });
});