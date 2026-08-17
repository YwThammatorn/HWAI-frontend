export type CourseStatus = "active" | "archived" | "draft";

export interface Course {
  id: string;
  code: string;
  name: string;
  semester: number;
  year: number;
  section: string;
  studentCount: number;
  assignmentCount: number;
  status: CourseStatus;
  createdAt: string;
}
