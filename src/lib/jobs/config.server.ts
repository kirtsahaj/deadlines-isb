import { ADMIN_EMAIL } from "@/lib/admin";
import type { IngestConfig } from "./pipeline";

/** Only the dedicated receiving address, forwarded by the owner, from the CAS sender, is accepted. */
export function ingestConfig(): IngestConfig {
  return {
    recipient: (process.env["JOBS_INBOUND_ADDRESS"] ?? "cas-jobs-74c9b2f6@meibime.resend.app").toLowerCase(),
    forwarders: [ADMIN_EMAIL],
    sender: "cas@isb.edu",
  };
}
