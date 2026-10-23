"""Converts the Hyderabad Term 5 handoff JSON into the app's server-only catalog/roster shape.

Usage: python3 scripts/import_hyderabad_term5.py <path/to/hyderabad-term5-master.json>
Deterministic: re-running with the same or an updated package rewrites the same files (no duplicates).
"""
import json, sys, pathlib

src = json.load(open(sys.argv[1]))
t = src["tables"]
out = pathlib.Path(__file__).resolve().parent.parent / "src/lib/term5/data"

def sec(section_id):
    """2026-HYD-T5-BRMT-A -> BRMT_A (campus is carried by the catalog itself)."""
    if not section_id:
        return None
    s = next((x for x in t["sections"] if x["section_id"] == section_id), None)
    return f'{s["course_code"]}_{s["section"]}' if s else None

PREP_KINDS = {"reading", "case", "reference", "optional", "recommended", "watch", "listen", "inclass", "after", "aftertask", "task", "graph", "context", "awaiting_lms_material"}

catalog = {
    "meta": {k: src["metadata"][k] for k in ["academic_year", "campus", "term", "timezone", "term_start", "term_end", "snapshot_date"]},
    "courses": [
        {"course_code": c["course_code"], "course_id": c["course_id"], "title": c["title"], "faculty": c.get("faculty"),
         "primary_source_id": c.get("primary_source_id"), "outline_status": c.get("outline_status")}
        for c in t["courses"]
    ],
    # Only sections that actually have students on the final list (ECSG_B is a stray timetable cell).
    "sections": [
        {"section_id": f'{s["course_code"]}_{s["section"]}', "course_code": s["course_code"], "section": s["section"], "roster_match": True}
        for s in t["sections"] if s.get("roster_match")
    ],
    "classes": [
        {"class_id": c["class_id"], "course_code": c["course_code"], "section_id": sec(c["section_id"]) or f'{c["course_code"]}_{c["section"]}',
         "starts_at": c["starts_at"], "ends_at": c["ends_at"], "room": c["room"],
         # NEGA1 (12 slots vs 10 outline classes) and other conflicts stay unmapped.
         "outline_session_id": None if c["session_mapping_status"] == "blocked_by_source_conflict" else c.get("outline_session_id"),
         "session_mapping_status": c["session_mapping_status"]}
        for c in t["classes"]
    ],
    "sessions": [
        {"outline_session_id": s["outline_session_id"], "course_code": s["course_code"], "session_labels": s["session_labels"],
         "title": s["title"], "source_id": s.get("source_id")}
        for s in t["outline_sessions"]
    ],
    "prep": [
        {"preparation_id": p["preparation_id"], "course_code": p["course_code"], "applies_to_session_labels": p["applies_to_session_labels"],
         "title": p["title"], "kind": p["kind"] if p["kind"] in PREP_KINDS else "context", "requirement": p.get("requirement") or "unspecified",
         "timing": p["timing"], "source_requirement_note": p.get("content_status") if p.get("content_status") not in (None, "") else None}
        for p in t["preparation_items"]
    ],
    "occurrences": [
        {"occurrence_id": o["occurrence_id"], "assessment_id": o["assessment_id"], "course_code": o["course_code"],
         "section_id": sec(o.get("section_id")), "study_group_scope": o.get("study_group_scope"), "title": o["title"],
         "date": o.get("date"), "time": o.get("time"), "due_at": o.get("due_at"), "date_precision": o["date_precision"],
         "deadline_rule": o.get("deadline_rule") or "", "provisional": bool(o.get("provisional")),
         "notification_ready": bool(o.get("notification_ready")), "source_id": o.get("source_id") or "",
         "source_pages": o.get("source_pages"), "status": o.get("mapping_status") or ""}
        for o in t["deadline_occurrences"]
        # Never surface stale prior-year dates (e.g. MKSV's 2024 simulation) as current deadlines.
        if not (o.get("date") or "").startswith(("2023", "2024", "2025"))
    ],
    "sources": {d["source_id"]: {"kind": d["kind"], "status": "active"} for d in t["source_documents"]},
}

students = {s["student_id"]: s["email"].lower().strip() for s in t["students"]}
roster: dict[str, list] = {}
for e in t["enrollments"]:
    email = students.get(e["student_id"])
    if email:
        roster.setdefault(email, []).append([e["course_code"], f'{e["course_code"]}_{e["section"]}', e.get("study_group")])
for rows in roster.values():
    rows.sort()

(out / "hyderabad-catalog.json").write_text(json.dumps(catalog, separators=(",", ":")))
(out / "hyderabad-roster.json").write_text(json.dumps(dict(sorted(roster.items())), separators=(",", ":")))
print(f"courses={len(catalog['courses'])} sections={len(catalog['sections'])} classes={len(catalog['classes'])} "
      f"prep={len(catalog['prep'])} occurrences={len(catalog['occurrences'])} students={len(roster)} "
      f"enrollments={sum(len(v) for v in roster.values())}")
