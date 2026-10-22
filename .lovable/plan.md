# Term 5 Companion — Build Plan

Expands the working tracker into a personal Term 5 (Mohali, 2026–27) companion. Existing sign-in, accounts, saved eLearn connections, background refresh, reminders and admin page stay intact.

## What students will see

1. **Works before connecting eLearn** — after Microsoft sign-in, the tracker privately matches the student to their roster courses and sections and shows outline deadlines and the class schedule right away. Unknown sections are never guessed; corrections live inside Menu.
2. **Three bottom tabs (icons only):** Deadlines, Schedule, Menu.
   - **Deadlines** — same cards, search, filters, "i" buttons, refresh and greeting. Upcoming nearest first, Past most recent first; undated items at the bottom.
   - **Schedule** — classes by day with room, topic and expandable preparation (required/recommended, before/in/after class). Preparation is never treated as a submission.
   - **Menu** — connection, my courses/sections, notifications, display, home-screen guide, help/troubleshooting, admin (Kirt only), sign out, and last: "Text Kirt on WhatsApp". Account deletion removed.
3. **Confidence dots** on every deadline and class instead of source text:
   - Green ● own eLearn, fresh · Teal ◐ classmate's eLearn, same section · Amber ○ outline/older/unconfirmed · Gray ? provisional.
   - Tapping shows the real source, last update, which section it applies to, any conflicting dates, and a "Connect your eLearn" button if not connected. No realtime or accuracy promises.
4. **Connect nudge** — small, consistent banner on all three tabs for unconnected students; disappears once connected.
5. **One deadline per assessment** — outline and eLearn copies of the same assessment merge into one card (both sources kept). Conflicting dates are shown, not hidden. Separate section/group assessments stay separate.
6. **Shared section updates** — non-personal deadline data from a connected classmate fills in for others in the same course and section (on by default). Grades, submissions, extensions and names are never shared. Other-section data is used only as a clearly labelled fallback.
7. **Alerts** — new-deadline alerts and 3-hour reminders continue. One notification per merged assessment. If found inside the 3-hour window, only one reminder is sent. Submitted items get no reminders.

## Build order

1. Database: roster, course sections, outline assessments, schedule sessions, preparation items, enrollment overrides, shared section deadlines, assessment links (merge records). Private by default; students read only their own roster rows.
2. Load Term 5 data: roster, schedule and outline assessments from the package. Revised STAR/MKTS outlines take priority; BVFS/ENVC/MTCC marked fallback; DTME and inferred dates marked provisional.
3. Matching and merging logic (course code + year + campus + term + section + assessment identity) with confidence calculation.
4. Background refresh: after each sync, publish safe non-personal items to section-shared data; reminders/alerts use merged assessments.
5. Screens: bottom tabs, Schedule, Menu consolidation, confidence dot + source dialog, connect nudge, enrollment correction.
6. Tests for each rule (matching, CDMA1 vs CDMA2, merge/conflict, ordering, reminder dedupe, sharing exclusions), then visual checks on phone and desktop.

## What can't be fully verified by me

- Live behavior of shared section data across multiple real connected students — I'll test with existing connections where possible and mocks otherwise, and say which was which.

## Technical notes

- New tables in public schema with RLS; roster lookup via verified sign-in email server-side.
- Shared data excludes submission status, grades, extensions, user IDs.
- Existing sync pipeline, sync policy, cron routes and Web Push stay; merge layer sits on top.
- Account deletion server function and UI removed; existing accounts untouched.
