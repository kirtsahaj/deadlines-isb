import { getRequest } from "@tanstack/react-start/server";

/** Nitro's Worker adapter binds the platform lifetime hook onto the Request. */
export function keepWorking(promise: Promise<unknown>): boolean {
  const request = getRequest() as Request & { waitUntil?: (work: Promise<unknown>) => void };
  if (!request.waitUntil) return false;
  request.waitUntil(promise);
  return true;
}