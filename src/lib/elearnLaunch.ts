export function createElearnLaunchUrl(): string {
  const url = new URL("https://elearn.isb.edu/admin/tool/mobile/launch.php");
  url.searchParams.set("service", "moodle_mobile_app");
  url.searchParams.set("passport", String(crypto.getRandomValues(new Uint32Array(1))[0]));
  url.searchParams.set("urlscheme", "moodlemobile");
  url.searchParams.set("confirmed", "1");
  return url.toString();
}