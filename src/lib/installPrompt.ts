export const INSTALL_READY_KEY = "isb-deadline-tracker-install-ready";
export const INSTALL_DISMISSED_KEY = "isb-deadline-tracker-install-dismissed";

export function shouldShowInstallPrompt(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(INSTALL_READY_KEY) === "true" && !storage.getItem(INSTALL_DISMISSED_KEY);
}
