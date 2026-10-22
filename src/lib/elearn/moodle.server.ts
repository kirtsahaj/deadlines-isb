import { elearnBaseUrl } from "./config.server";

const ALLOWED = new Set([
  "core_webservice_get_site_info",
  "core_enrol_get_users_courses",
  "core_course_get_contents",
  "mod_assign_get_assignments",
  "mod_assign_get_submission_status",
  "mod_quiz_get_quizzes_by_courses",
  "mod_forum_get_forums_by_courses",
  "core_calendar_get_calendar_events",
  "mod_choice_get_choices_by_courses",
]);

const RETRYABLE = new Set([429, 502, 503, 504]);
const SAFE_CODES = new Set([
  "invalidtoken",
  "accessexception",
  "webservice_access_exception",
  "invalidparameter",
  "requireloginerror",
  "invalidresponse",
]);

export class MoodleError extends Error {
  constructor(
    public code: string,
    message = "Moodle request failed",
  ) {
    super(message);
    this.name = "MoodleError";
  }
}

function add(form: URLSearchParams, prefix: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => add(form, `${prefix}[${i}]`, item));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9_]+$/.test(key)) throw new MoodleError("parameters");
      add(form, prefix ? `${prefix}[${key}]` : key, item);
    }
    return;
  }
  if (!["string", "number", "boolean"].includes(typeof value)) throw new MoodleError("parameters");
  form.set(prefix, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const readOnlyFunctions = [...ALLOWED];

export class MoodleClient {
  private endpoint: URL;
  private waiting: Array<() => void> = [];
  private active = 0;

  constructor(private token: string, private deadline = Infinity) {
    if (!/^[A-Za-z0-9]{16,128}$/.test(token)) throw new MoodleError("credentials");
    const base = new URL(elearnBaseUrl());
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
      throw new MoodleError("configuration");
    }
    this.endpoint = new URL(
      `${base.pathname.replace(/\/$/, "")}/webservice/rest/server.php`,
      base.origin,
    );
  }

  async call(
    functionName: string,
    params: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | unknown[]> {
    if (this.active >= 6) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      return await this.performCall(functionName, params);
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  private async performCall(
    functionName: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown> | unknown[]> {
    if (!ALLOWED.has(functionName)) throw new MoodleError("read_only");
    if (["wstoken", "wsfunction", "moodlewsrestformat"].some((key) => key in params)) {
      throw new MoodleError("parameters");
    }
    const form = new URLSearchParams({
      wstoken: this.token,
      wsfunction: functionName,
      moodlewsrestformat: "json",
    });
    for (const [key, value] of Object.entries(params)) add(form, key, value);

    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = this.deadline - Date.now();
      if (remaining <= 0) throw new MoodleError("timeout");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(30_000, remaining));
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "isb-deadline-tracker/1.0",
          },
          body: form,
          redirect: "manual",
          signal: controller.signal,
        });
        if (response.status >= 300 && response.status < 400) throw new MoodleError("redirect");
        if (RETRYABLE.has(response.status) && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? 0);
          await sleep(
            retryAfter > 0 && retryAfter <= 10
              ? retryAfter * 1000
              : Math.min(2000, 250 * 2 ** attempt),
          );
          continue;
        }
        if (!response.ok) throw new MoodleError("http");
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (contentType.includes("html")) throw new MoodleError("non_json");
        const text = await response.text();
        if (text.length > 20_000_000) throw new MoodleError("too_large");
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new MoodleError("non_json");
        }
        if (!data || typeof data !== "object") throw new MoodleError("schema");
        const envelope = data as Record<string, unknown>;
        if ("exception" in envelope || "errorcode" in envelope) {
          const code = String(envelope["errorcode"] ?? "moodle_error");
          throw new MoodleError(SAFE_CODES.has(code) ? code : "moodle_error");
        }
        return data as Record<string, unknown> | unknown[];
      } catch (error) {
        if (error instanceof MoodleError) throw error;
        if (attempt === 2) {
          throw new MoodleError(
            error instanceof Error && error.name === "AbortError" ? "timeout" : "network",
          );
        }
        await sleep(250 * 2 ** attempt);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new MoodleError("network");
  }
}
