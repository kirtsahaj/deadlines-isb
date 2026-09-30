export type CourseMetadata = {
  courseCode: string;
  term: string;
};

export const OTHER_FILTER_VALUE = "Other";

export function parseCourseMetadata(shortName: string | null | undefined): CourseMetadata {
  const segments = (shortName ?? "")
    .trim()
    .split("_")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return { courseCode: OTHER_FILTER_VALUE, term: OTHER_FILTER_VALUE };
  }

  return {
    courseCode: segments[0] || OTHER_FILTER_VALUE,
    term: segments[segments.length - 1] || OTHER_FILTER_VALUE,
  };
}

export function selectedOrAll(values: string[], selected: Set<string> | null): Set<string> {
  return selected ?? new Set(values);
}