export type PhoneBrowser = { platform: "ios" | "android"; chrome: boolean };

export function detectPhoneBrowser(userAgent: string, maxTouchPoints = 0): PhoneBrowser | null {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) {
    return { platform: "ios", chrome: /CriOS\//.test(userAgent) };
  }
  if (/Android/.test(userAgent)) {
    return { platform: "android", chrome: /Chrome\//.test(userAgent) && !/EdgA|OPR|SamsungBrowser|; wv/.test(userAgent) };
  }
  return null;
}

/** Use only on an explicit tap, with a public tracker or fresh eLearn setup URL. */
export function chromeOpenUrl(httpsUrl: string, platform: PhoneBrowser["platform"]): string {
  const url = new URL(httpsUrl);
  if (url.protocol !== "https:") throw new Error("https_required");
  if (platform === "ios") return `googlechromes://${url.host}${url.pathname}${url.search}${url.hash}`;
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
}