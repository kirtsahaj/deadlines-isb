<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Derive deadline term/course filters at runtime from Moodle short names so existing rows need no migration.
- Keep phone installability manifest-only; offline caching is intentionally excluded to protect fresh authenticated data.
- eLearn launch URLs are generated on interaction in a shared browser-safe helper so every attempt gets a fresh passport.
- Clipboard connection goes through a browser-safe helper that validates before sending only the REST token; permission failures return a manual-paste outcome without attempting a connection.
- Managed scheduled routes authenticate with the generated cron helper; dispatch one bounded account sync per same-origin invocation and retain it through the Worker request waitUntil hook so scheduler timeouts do not interrupt work.
- The shared sync policy gates snapshot removal and fresh-data success; both initial and background sync use the same read-only pipeline to preserve deadline semantics.
- Background refresh runs on a 15-minute tick; each account gets a stable hash-derived slot in a 2-hour cycle so load spreads evenly as users grow, and dispatch is throttled to pairs to stay polite to eLearn.
- Deadline reminders use self-contained WebCrypto Web Push (src/lib/push) driven by a managed 15-minute schedule, deduped per deadline+due time; no Node push libraries because the server runs on Workers.
- The admin dashboard is limited to one hardcoded email, checked server-side through the verified sign-in email, because the owner asked that only they have access.
