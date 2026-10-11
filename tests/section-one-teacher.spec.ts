import { test, expect } from "@playwright/test";
import fs from "node:fs";

// 11/10/2569 — one subject, one teacher: every section of a subject offered in the same term is taught by the SAME
// teacher (no empty section, no section with two teachers). Guards the mock data in both locales and both copies
// (public/mock-data is what the console commands fetch, test-data is the committed twin).

type Course = { id: string; name: string; courseTemplateId?: string; academicYear?: number; term?: number; sectionNumber?: string };
type Teacher = { id: string; name: string; courseIds: string[] };

const read = <T,>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8"));
const subjectKey = (c: Course) => `${c.courseTemplateId ?? c.name}|${c.academicYear}|${c.term}`;

for (const dir of ["public/mock-data", "test-data"]) {
  for (const suffix of ["", "-en"]) {
    test(`${dir} teachers${suffix}: all sections of a subject in one term share one teacher`, () => {
      const courses = read<Course[]>(`${dir}/courses-mockup${suffix}.json`);
      const teachers = read<Teacher[]>(`${dir}/teachers-mockup${suffix}.json`);
      const teachersOf = (id: string) => teachers.filter((t) => t.courseIds.includes(id)).map((t) => t.id);
      const groups = new Map<string, Course[]>();
      courses.forEach((c) => groups.set(subjectKey(c), [...(groups.get(subjectKey(c)) ?? []), c]));

      const multi = [...groups.entries()].filter(([, g]) => g.length > 1);
      expect(multi.length, "the mock should still contain multi-section subjects").toBeGreaterThanOrEqual(8);
      const problems = multi.flatMap(([key, g]) => {
        const per = g.map((c) => ({ id: c.id, teachers: teachersOf(c.id) }));
        const distinct = new Set(per.flatMap((p) => p.teachers));
        const bad = per.some((p) => p.teachers.length !== 1) || distinct.size !== 1;
        return bad ? [`${key}: ${per.map((p) => `${p.id}=[${p.teachers.join("+") || "none"}]`).join(" ")}`] : [];
      });
      expect(problems).toEqual([]);
    });

    test(`${dir} teachers${suffix}: every course has exactly one teacher (creating a course requires one, so the mock has no "No teachers assigned")`, () => {
      const courses = read<Course[]>(`${dir}/courses-mockup${suffix}.json`);
      const teachers = read<Teacher[]>(`${dir}/teachers-mockup${suffix}.json`);
      const bad = courses.map((c) => ({ id: c.id, n: teachers.filter((t) => t.courseIds.includes(c.id)).length })).filter((x) => x.n !== 1);
      expect(bad).toEqual([]);
      const dangling = teachers.flatMap((t) => t.courseIds).filter((id) => !courses.some((c) => c.id === id));
      expect(dangling).toEqual([]);   // no teacher points at a course that is not in the file
    });
  }
}
