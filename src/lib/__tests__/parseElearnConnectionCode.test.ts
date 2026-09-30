import { describe, expect, it } from "vitest";
import { parseElearnConnectionCode } from "../parseElearnConnectionCode";

const REST_TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const PRIVATE_TOKEN = "PRIVATEautologinTOKEN0000000000000";

function code(parts: string[]): string {
  return btoa(parts.join(":::"));
}

describe("parseElearnConnectionCode", () => {
  const encoded = code(["signature", REST_TOKEN, PRIVATE_TOKEN]);

  it("extracts only the read-only token from a console error line", () => {
    const line = `Failed to launch 'moodlemobile://token=${encoded}' because the scheme does not have a registered handler.`;
    expect(parseElearnConnectionCode(line)).toBe(REST_TOKEN);
  });

  it("never returns the private autologin token", () => {
    const result = parseElearnConnectionCode(`moodlemobile://token=${encoded}`);
    expect(result).not.toContain(PRIVATE_TOKEN);
  });

  it("accepts a Location response header from the network fallback", () => {
    expect(parseElearnConnectionCode(`moodlemobile://token=${encoded}`)).toBe(REST_TOKEN);
  });

  it("tolerates surrounding quotes and whitespace", () => {
    expect(parseElearnConnectionCode(`  "moodlemobile://token=${encoded}"  `)).toBe(REST_TOKEN);
  });

  it("rejects text with no token", () => {
    expect(() => parseElearnConnectionCode("just some pasted text")).toThrow(
      "invalid_connection_code",
    );
  });

  it("rejects a token payload that does not decode to a valid key", () => {
    expect(() => parseElearnConnectionCode(`moodlemobile://token=${btoa("nope")}`)).toThrow(
      "invalid_connection_code",
    );
  });
});
