# Placements feed: inbound email setup plan (no build yet)

## What I checked in this project
- **Built-in email:** no email domain is set up. Lovable's built-in email only **sends** mail. Its only incoming webhook reports bounces, complaints and unsubscribes for mail the app sent. It cannot give you a receiving address or deliver incoming messages and attachments. **Lovable Cloud cannot natively create a private receiving address.**
- **Connected services in the workspace:** only GitHub. Nothing for Resend, Outlook or any other mail service is connected.
- **Outlook connector:** not usable. It needs the same Microsoft consent that ISB's tenant admin refused.

## Recommendation: Resend Receiving on its free `*.resend.app` address
- Resend gives every account a managed receiving domain (`<something>.resend.app`). Any address on it receives mail. **You do not need to buy a domain or change DNS.**
- When mail arrives, Resend sends a signed `email.received` webhook. The webhook only carries metadata. The app then fetches the full body, the headers and attachment download links (valid for 1 hour) from the Receiving API.
- **Cost:** the Free plan costs $0 and includes 3,000 emails a month (100 a day). Received mail counts toward that quota. CAS volume is far below this. Pro is $20 a month if it is ever needed.
- **Through the Lovable connector:** Resend is available as a connector. The gateway forwards Resend's whole API, so the Receiving and Attachments endpoints should work through it. I haven't tested this because no Resend connection exists yet. The first build step is one harmless read-only call to confirm it. Incoming webhooks go straight from Resend to the app and never pass through the gateway. If the gateway rejects the receiving endpoints, the fallback is a Resend API key saved as a project secret.

## Biggest risk to check before building
ISB's Microsoft 365 most likely blocks **automatic** forwarding to outside addresses. Microsoft blocks this by default, and the same admin refused consent for read access. Two ways to forward:
1. **Inbox rule auto-forward** (only from cas@isb.edu, matching subject). This may be silently blocked or bounced with "external forwarding disabled".
2. **Manual Forward** of each job email by the owner. This always works and is more selective. Plan for this, and treat auto-forward as a bonus if ISB allows it.

## Setup steps and who does each

| Step | Who | Notes |
|---|---|---|
| 1. Create a Resend account (free) | Owner logs in at resend.com | I can't create accounts |
| 2. Turn on Receiving and note the `*.resend.app` address | Owner in Resend | Pick a hard-to-guess local part, e.g. `cas-7f3k9q@…resend.app` |
| 3. Create an API key with access to read received mail | Owner in Resend | Linked through the Resend connector (secure form), never pasted in chat |
| 4. Link the connection to this project | Me, after step 3 | Then one read-only test call |
| 5. Add a webhook for `email.received` pointing at the published app's private endpoint | Owner in Resend (I give the exact URL) | Uses the published URL, not the preview |
| 6. Save the webhook signing secret | Owner, through the secure secret form | Stored as a project secret |
| 7. Forward one real CAS job email | Owner | First live test; I check the logs and do not send any mail myself |
| 8. Optional: Outlook rule to auto-forward from cas@isb.edu | Owner | Only if ISB allows it; manual Forward otherwise |

**Total cost: $0. No domain purchase and no DNS changes.**

## Security design for the build
- **Signed webhook:** check Resend's (Svix) signature on the untouched raw body, check the timestamp window, and reject anything else. The endpoint returns nothing private.
- **Source checks, not just the From line:**
  - The recipient must be the exact secret address.
  - The outer sender must be the owner's ISB address.
  - The received headers must show DKIM/ARC passing for isb.edu.
  - The forwarded original must contain a cas@isb.edu sender with expected CAS markers.
  - Mail that fails any check is quarantined (metadata only) and never published.
- **Scope filter (allow-list):** accept only job broadcasts and "Job Details Modified". Reject anything that looks like application, submission, shortlist-result or personal-status mail, even when it comes from CAS. The owner's own forwarding header and quoted personal text are removed before storing.
- **Idempotency:** a unique key on the Resend email ID plus the original Message-ID, so retries and duplicate forwards never create two jobs.
- **Modification merging:** a "Job Details Modified" message changes only the fields it explicitly states (deadline, shortlist date, role…). Everything else stays as it was, and each version keeps its history.
- **Attachments:** download on the server within the 1-hour link window. Accept only PDF/DOC/DOCX up to about 15 MB, checked by real file type. Store them in private storage, served only to signed-in ISB users through short-lived links. No executables, archives or inline images.
- **No tracking:** never load remote images or pixels. Show only plain text or HTML stripped of `<img>` tags and remote resources.
- **Privacy:** the shared feed holds only sanitized job fields. Stars are private per user, protected so others can't read them. No HireTrack credentials, actions or personal application status.
- **Existing app untouched:** eLearn, deadlines, prereads, reminders and the rule that off-roster users see only their personal tracker all stay as they are. Placements is a separate tab/page for signed-in @isb.edu users.

## After setup (later feature build, not now)
Job tiles show company, role, application deadline, expected shortlist date and the JD attachment when there is one. They also include private stars and search, sort and filter. I'll propose this as a separate plan once a real forwarded email has come in and been checked.

## Decisions needed from you
1. Go with Resend Free on `*.resend.app`? (recommended)
2. Can you try one Outlook rule to forward to an outside test address, so we know whether ISB blocks auto-forwarding? Otherwise we plan for manual Forward.
