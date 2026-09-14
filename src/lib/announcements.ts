"use client";

import { createContext, useContext } from "react";

export type AnnouncementScope = "this-section" | "all-sections";

export interface Announcement {
  id: string;
  /** The course (= section instance) the teacher posted this from. */
  authorCourseId: string;
  /**
   * "this-section": only students in authorCourseId see it.
   * "all-sections": every Course sharing courseTemplateId + term + academicYear
   * with authorCourseId sees it too — the courseTemplateId/term/academicYear
   * below are what "same subject, same offering" is computed from.
   */
  scope: AnnouncementScope;
  courseTemplateId?: string;
  term?: string | number;
  academicYear?: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementContextValue {
  announcements: Announcement[];
  addAnnouncement: (data: Omit<Announcement, "id" | "createdAt" | "updatedAt">) => Announcement;
  removeAnnouncement: (id: string) => void;
  getAnnouncementsByAuthorCourse: (courseId: string) => Announcement[];
}

export const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

export function useAnnouncements(): AnnouncementContextValue {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error("useAnnouncements must be used within AnnouncementProvider");
  return ctx;
}

/**
 * Whether `announcement` should be visible to students/teachers viewing `course`.
 * Shared by both the teacher authoring view and the student-facing feed so
 * "which sections does this reach" is computed exactly once.
 */
export function announcementReachesCourse(
  announcement: Announcement,
  course: { id: string; courseTemplateId?: string; term?: string | number; academicYear?: number }
): boolean {
  if (announcement.authorCourseId === course.id) return true;
  return (
    announcement.scope === "all-sections" &&
    !!announcement.courseTemplateId &&
    announcement.courseTemplateId === course.courseTemplateId &&
    String(announcement.term) === String(course.term) &&
    announcement.academicYear === course.academicYear
  );
}
