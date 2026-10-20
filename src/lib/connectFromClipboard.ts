import { parseElearnConnectionCode } from "./parseElearnConnectionCode";

/** Called only by the student's explicit paste action. Never retains the copied link. */
export async function connectFromClipboard<T>(
  clipboard: Pick<Clipboard, "readText"> | undefined,
  connect: (token: string) => Promise<T>,
): Promise<{ kind: "manual" } | { kind: "connected"; result: T }> {
  if (!clipboard?.readText) return { kind: "manual" };
  let raw: string;
  try {
    raw = await clipboard.readText();
  } catch {
    return { kind: "manual" };
  }
  const token = parseElearnConnectionCode(raw);
  return { kind: "connected", result: await connect(token) };
}