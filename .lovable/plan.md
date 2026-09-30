# ISB Deadline Tracker V2

## Goal
Update the existing tracker in place while preserving authentication, encrypted eLearn credentials, read-only Moodle access, per-user isolation, synced data, and cleanup behavior.

## Connection and phone setup
- Rewrite the connection guide as one short four-step laptop flow, making Network → `launch.php` → Headers → Location the primary method.
- Keep the existing Microsoft sign-in illustration and replace the other guide imagery with the two supplied, privacy-redacted real-flow screenshots.
- Keep parsing entirely in browser memory, accept quoted or unquoted Location values, send only the extracted REST token, clear the field immediately, and keep troubleshooting collapsed.
- Add an installable web-app manifest, appropriate icons/display settings, and install handling.
- Show a once-only, dismissible “Add Deadline Tracker to your phone” prompt after a completed first setup; use the native prompt when available and platform instructions otherwise. Repeatable instructions remain in Help and Settings.

## Deadline experience
- Replace the time-based greeting with `Hello {first name}!`, sourced from verified Microsoft metadata, then the stored profile, then a neutral fallback.
- Split deadlines into Upcoming and Past views. Upcoming uses dated future items ascending with TBD last; Past uses expired items descending. The exact current instant is the boundary, with the selected display timezone used consistently for presentation.
- Add reusable short-name parsing for dynamic Term and Course values, including safe `Other` fallbacks, and multi-select filters that initially include everything. Course choices narrow to selected terms.
- Keep search and type filtering in both views and make course codes easier to scan on deadline tiles.
- Replace inline evidence expansion with an accessible information dialog containing source, evidence, conflict, and unconfirmed-date context without technical payloads.

## Sync, account, and visual polish
- Preserve cached deadlines and source-level diagnostics while replacing both partial-sync phrases with calm guidance that existing dates remain available and another refresh can be tried later.
- Give Refresh and Last synced a clearer secondary treatment while retaining the server cooldown and client duplicate-request lock.
- Remove Sign out from the top bar and place it in a separated section at the bottom of Settings. Ordinary sign-out will only end the browser session; it will not disconnect eLearn or delete deadlines.
- Refine spacing, hierarchy, cards, filters, empty states, and subtle interaction feedback across desktop and mobile without adding dashboard clutter or engagement mechanics.

## Data and technical approach
- Derive term/course metadata from existing course short names so current data works immediately; no destructive backfill is required.
- Add small shared modules for course metadata, deadline partition/sort behavior, preferred-name handling, and install state so behavior is independently testable.
- Record the PWA registration and derived-filter architecture in the project decision notes.

## Verification
- Add automated coverage for short-name parsing, malformed fallbacks, multi-select defaults/relationships, exact-now partitioning, timezone-safe comparison, future/past ordering, TBD placement, preferred-name fallback, install prompt persistence, and sign-out preserving account-scoped connection data.
- Re-run all existing parser/normalization tests, lint, type checks, build, and security checks.
- Browser-test the revised guide, evidence dialog, filters, upcoming/past views, Settings sign-out placement, install guidance, and responsive layouts.
- Verify same-account sign-out/sign-in against the live preview when an authenticated test session is available; a fresh private eLearn code will only be needed for a new live connection/reconnection test.
- Publish the finished update and include the requested report: prior partial-sync triggers, new communication, changed files/migrations, exact test results, remaining live verification, and preview URL.
