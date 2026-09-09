# Website Test Flow — Baseline ก่อน Phase 4

**สถานะ: รันแล้ว 4-5/9/2569** ผ่าน dev server จริง (Browser tool, dev-bypass login) — ผลลัพธ์อยู่ในส่วน "ผลการทดสอบจริง" ท้ายไฟล์ **ไม่พบบัคจริง** (รอบแรกสงสัยว่าเจอ 1 จุด แต่ re-verify แล้วเป็น false positive จาก test tooling — ดูรายละเอียด)

ทดสอบหน้าเว็บจริงของแอป (ไม่ใช่ paper validation) — ครอบคลุม journey ที่เกี่ยวข้องกับงาน Phase 1-2 (Section/Role/TA model) มากที่สุด ใช้เป็น **baseline ก่อน Phase 4 แก้โค้ดจริง** — รันรอบนี้ก่อน แล้วรันซ้ำหลัง Phase 4 เพื่อเช็คว่าไม่มีอะไรพัง

**Dev bypass login:** หน้า `/login` มีปุ่ม "Admin / Teacher / Student" มุมล่างให้ข้าม auth จริงได้

---

## Flow 1 — Teacher: Grading Workflow (สำคัญสุด — ตอบข้อ 6/7)

| # | Action | Expected |
|---|---|---|
| 1.1 | Login → Teacher (dev bypass) | เข้า `/teacher/dashboard` |
| 1.2 | คลิกเข้าวิชาใดวิชาหนึ่ง → Assignments | เห็นรายการชิ้นงาน |
| 1.3 | เปิดชิ้นงานที่มี submission แล้ว → Grading | เห็น student list ซ้าย + rubric/submission ขวา |
| 1.4 | แก้คะแนน AI ที่ rubric item ใดหนึ่ง + ใส่ comment → Save | คะแนนเปลี่ยน, comment บันทึก |
| 1.5 | กลับไปที่ Results (course-level) | คะแนนที่แก้แล้วสะท้อนในผลรวม |
| 1.6 | เปิดหน้า Recheck | เห็นสถานะ/ประวัติที่เกี่ยวกับ Q6 (อาจารย์ override) |

**สังเกต:** ตอนนี้ยังไม่มี `ai_score` vs `teacher_score` แยกกันจริงในโค้ด (ตามคำตอบข้อ 6 ที่ยังเป็น design ไม่ใช่ implement) — flow นี้ทดสอบว่า UI ปัจจุบันรองรับการแก้คะแนนได้ ไม่ใช่ทดสอบ data model ใหม่ที่ยังไม่ landing

## Flow 2 — Teacher: CLO / Section (เกี่ยวกับ Phase 1 โดยตรง)

| # | Action | Expected |
|---|---|---|
| 2.1 | เข้าวิชา → CLO | เห็นรายการ CLO ผูกกับ PLO |
| 2.2 | เพิ่ม CLO ใหม่ + เลือก PLO ที่สนับสนุน → Save | CLO ใหม่ปรากฏในตาราง |
| 2.3 | เปิด Course Settings | เช็คว่ามี field อะไรบ้างตอนนี้ (ยังไม่มี `publishMode`/`gradingSource` จริง — จะเพิ่มใน Phase 4) |

## Flow 3 — Teacher: Collaborators (TA) — เกี่ยวกับ SectionRole โดยตรง

| # | Action | Expected |
|---|---|---|
| 3.1 | เข้าวิชา → Collaborators | เห็นรายชื่อ TA/co-teacher ปัจจุบัน |
| 3.2 | เพิ่ม TA คนใหม่ | ปรากฏในลิสต์ |
| 3.3 | ลบ TA | เจอ `window.confirm()` ก่อนลบจริง (ยืนยันจาก Sprint 3 memory) |

**สังเกตสำหรับ Phase 4:** ตอนนี้ TA ผูกกับ Course ทั้งก้อน ไม่ใช่ Section — หลัง migrate ต้อง re-test ว่า TA ที่เพิ่มในวิชานี้ ไม่หลุดไปปรากฏใน section อื่นของวิชาเดียวกัน

## Flow 4 — Teacher: Student Import + Sequence Numbering

| # | Action | Expected |
|---|---|---|
| 4.1 | เข้าวิชา → Students → Import CSV | อัปโหลด `test-data/students_sample.csv` |
| 4.2 | ดูผล import | นักศึกษาใหม่ต่อท้ายลิสต์เดิม |
| 4.3 | เช็คเลขลำดับนักศึกษา (ถ้ามี) | ตอนนี้ยังไม่มี `sequenceNumber` field จริง (มติประชุม 4/9 — จะเพิ่มใน Phase 4) — flow นี้ทำหน้าที่ยืนยันว่า "ยังไม่มี" ก่อนแก้ ไม่ใช่ยืนยันว่ามี |

## Flow 5 — Admin: User Management

| # | Action | Expected |
|---|---|---|
| 5.1 | Login → Admin (dev bypass) | เข้า `/admin` |
| 5.2 | ไป `/admin/users` → แท็บ Teachers | เห็นรายชื่ออาจารย์ + suspend/reactivate button |
| 5.3 | สลับแท็บ Students | เห็นรายชื่อนักศึกษา — **เช็คว่ามีปุ่ม suspend/status หรือไม่** (ตามมติประชุม #1 ควรมี active/inactive เหมือนอาจารย์ — ตอนนี้คาดว่ายังไม่มี ยืนยันด้วย flow นี้) |
| 5.4 | ไป `/admin/courses` | เห็นรายวิชาทั้งหมด, มอบหมายอาจารย์ได้ |

## Flow 6 — Student: Submission

| # | Action | Expected |
|---|---|---|
| 6.1 | Login → Student (dev bypass) | เข้า `/student` |
| 6.2 | เข้าวิชา → Classwork | เห็นสถานะ ส่งแล้ว/ยังไม่ส่ง/เลยกำหนด |
| 6.3 | เปิดชิ้นงาน → Submit | ส่งงานได้ |
| 6.4 | ส่งซ้ำรอบ 2 (แก้ไฟล์) | **เช็คว่ามี version history หรือทับของเดิม** — ตอบข้อ 8 ต้องมี แต่ยังไม่ยืนยันว่า implement แล้ว |

## Flow 7 — Auth: Role Boundaries

| # | Action | Expected |
|---|---|---|
| 7.1 | Login Teacher → พยายามเข้า `/admin/users` ตรงๆ ทาง URL | ถูก block/redirect (role guard ทำงาน) |
| 7.2 | Login Student → พยายามเข้า `/teacher/dashboard` ตรงๆ | ถูก block/redirect |

---

## สรุปสิ่งที่คาดว่าจะ "ยังไม่มี" (baseline นี้ควรยืนยัน ไม่ใช่แปลกใจ)

Flow นี้ไม่ได้แค่เช็คว่าอะไร "พัง" — บาง step ตั้งใจเช็คว่าฟีเจอร์จาก Phase 1 model **ยังไม่ landing ในโค้ด** เพื่อยืนยัน baseline ก่อน Phase 4:
- Student status (active/inactive) — Flow 5.3
- `publishMode`/`gradingSource` ต่อ Section — Flow 2.3
- `sequenceNumber` ต่อนักศึกษา — Flow 4.3
- Submission version history — Flow 6.4
- TA ผูกกับ Section ไม่ใช่ Course ทั้งก้อน — Flow 3 หมายเหตุ

ถ้า step ไหนพบว่า "มีแล้ว" ผิดจากที่คาด ให้กลับไปเช็ค code จริงก่อนเชื่อ — memory/แผนอาจจะตกยุคกว่าที่คิด (เหมือนที่เจอใน Phase 2 validation)

## ผลการทดสอบจริง (4/9/2569)

รันผ่าน dev server จริง, dev-bypass login, Teacher/Admin/Student ตามลำดับ

### ~~🔴 บัคที่คิดว่าพบ~~ → ✅ False positive จาก test tooling, ไม่ใช่บัคจริง (แก้ไข 5/9/2569)

รอบแรกรายงานว่าคะแนน override ไม่ persist (Flow 1.4–1.5) — **หลัง re-verify อย่างละเอียดพบว่าเป็นปัญหาจากเครื่องมือทดสอบเอง ไม่ใช่แอป**: `computer` click ของ Browser tool ไม่ได้คลิกโดนปุ่ม "บันทึก" จริงตลอด session นั้น (ปัญหา rendering pane ที่เจอมาตลอด — screenshot timeout, viewport 0x0, "pane hidden") ทำให้ดูเหมือนกดแล้วข้อมูลหาย ทั้งที่จริงปุ่มไม่เคยถูกกดเลย

**วิธี re-verify:** ยิง `btn.click()` ผ่าน `javascript_tool` ตรงๆ (ข้าม Browser automation layer ที่มีปัญหา) → เช็ค `localStorage.hwai_submissions_v1` ทันที → พบ `instructorScore: 95` เขียนถูกต้อง → navigate ไปหน้า Results → ค่าเฉลี่ยขึ้นเป็น **85.4** ตรงตามสูตรเป๊ะ ((95+76+92+85+79)/5) ยืนยันว่า persistence layer (`AssignmentProvider.tsx` → `updateSubmission` → `persistS` → `localStorage.setItem`) ทำงานถูกต้องสมบูรณ์

**บทเรียน:** เมื่อรัน test flow ผ่าน Browser automation แล้วผลลัพธ์ดู "พัง" ให้เช็คว่าปุ่ม/action นั้นเปลี่ยนสถานะ UI จริงหรือไม่ (เช่น "กำลังบันทึก…" หรือ "บันทึกแล้ว ✓" ที่ควรขึ้นชั่วคราว) ก่อนสรุปว่าเป็นบัคแอป — ถ้า UI ไม่ขยับเลยหลังคลิก มีโอกาสสูงว่าคลิกไม่ได้ลงจริง ให้ยืนยันด้วย `btn.click()` ตรงๆ ก่อนฟันธง

### ✅ ผ่านตามคาด

| Flow | ผล |
|---|---|
| 1.1–1.3, 1.6 | Login, course list, assignment list, grading page, recheck page (breakdown ต่อ rubric item + AI confidence 92% + comment ต่อข้อ) ทำงานถูกต้องทั้งหมด |
| 2.1 | CLO ผูก PLO ได้ (3 CLO แสดงถูก) |
| 2.3 | Course Settings มีแค่ชื่อ/คำอธิบาย/สี/Archive-Delete — **ไม่มี publishMode/gradingSource ตามที่คาด** ยืนยัน scope ของ Phase 4 |
| 3.1 | Collaborators แสดง 1 Teacher + 2 TA พร้อม permission label ถูกต้อง |
| 4.1 | Import CSV template แสดงถูก, "email ไม่บังคับ" |
| 7.1–7.2 | Role guard ทำงานทั้ง 2 ทิศทาง (Teacher→admin ถูกกัน, Student→teacher ถูกกัน) |

### ⚠ พบ note ที่ต้องเอาไปคิดต่อใน Phase 4

- **Flow 3**: TA permission label เขียนว่า "ตรวจและแก้ไขได้" — คำว่า "แก้ไข" กำกวม ไม่ชัดว่าหมายถึงแก้คะแนนอย่างเดียวหรือแก้ course settings ด้วย ต้องเขียน label ใหม่ให้ตรงกับ decision #4 (TA ห้ามแก้ settings) ตอนสร้าง `SectionRole` UI
- **Flow 4**: "email ไม่บังคับ" ใน CSV import ยืนยันว่า auto-generate email จาก student_id (ตามที่เสนออาจารย์ไว้ในเอกสาร Phase 2) ใช้ได้จริงกับ flow ปัจจุบัน ไม่ต้องปรับ

### ⏸ ทดสอบไม่ได้ — ไม่ใช่บัค แค่ไม่มี seed data

- Flow 5.3 (student suspend/status), Flow 6.2–6.4 (submit, versioning) — Admin/Student portal ที่ dev-bypass login ไม่มี cohort/enrollment seed ผูกมาด้วย (ตรงกับที่ memory เคยบันทึกไว้: "Student login ต้อง import cohort ก่อน ไม่มี seed สำเร็จรูป") ต้องเตรียม seed data ก่อนถึงจะทดสอบ 2 flow นี้ได้จริง

## After Phase 4 — สิ่งที่ต้อง re-run

รัน flow ทั้งหมดซ้ำ + เพิ่มเช็ค:
- Flow 3: TA ที่เพิ่มใน Section A ไม่ปรากฏใน Section B ของ CourseTemplate เดียวกัน
- Flow 5.3: ปุ่ม active/inactive ปรากฏสำหรับนักศึกษาแล้ว แยกจาก enrollment status
- Flow 2.3: publishMode/gradingSource เลือกได้จริงต่อ Section
- Playwright E2E suite (82/82 baseline) — ต้องยัง pass หรือ fail ที่เข้าใจได้ว่าทำไม

---

## Flow 8 — Admin: Curriculum Management (Stage B, ใหม่ 5/9/2569)

| # | Action | Expected |
|---|---|---|
| 8.1 | Login → Admin (dev bypass) → `/admin/curriculum` | เห็น empty state ถ้ายังไม่มีข้อมูล |
| 8.2 | สร้างหลักสูตร (เลือกโปรแกรม CE/CEI/CECS + label + ปีเริ่มใช้) → Save | ปรากฏใน "หลักสูตรที่ใช้อยู่", stat card 3 ใบอัปเดตทันที |
| 8.3 | ขยาย accordion แถวหลักสูตร → "+ เพิ่มรายวิชา" → กรอกรหัส/ชื่อวิชา → Save | รายวิชาปรากฏในแผงย่อย, ตัวเลข "รายวิชา" ที่แถวหลักอัปเดต |
| 8.4 | กดลบหลักสูตรที่มีรายวิชาอยู่ | Confirm dialog ต้องระบุจำนวนรายวิชาที่จะถูกลบไปด้วย (cascade warning) ไม่ใช่แค่ "ลบหลักสูตรนี้?" เฉยๆ |
| 8.5 | กด "ยกเลิก" ที่ confirm dialog | ข้อมูลไม่หาย |

### ผลจริง (5/9/2569)
✅ ผ่านทุกข้อ — สร้างหลักสูตร "CE 2569" สำเร็จ, stat cards ขึ้น 1/1/0 ถูกต้อง, เพิ่มวิชา "การออกแบบ UX/UI" (01076312) แล้ว stat "รายวิชาทั้งหมด" ขึ้นเป็น 1, cascade-delete dialog ข้อความ `"CE 2569" และรายวิชาทั้ง 1 วิชาภายใต้หลักสูตรนี้จะถูกลบถาวร` ตรงตามคาด, กด ยกเลิก แล้วข้อมูลยังอยู่ครบหลัง restart dev server (ทดสอบ persistence ข้าม server restart จริงเพราะบังเอิญต้องรีสตาร์ตระหว่าง debug — เห็นข้อมูลเดิมกลับมาแสดง ยืนยันว่าอยู่ใน localStorage ของ browser ไม่ใช่ state ฝั่ง server)

## Flow 9 — Teacher: Collaborators (SectionRole) — Re-run หลัง Stage B

| # | Action | Expected |
|---|---|---|
| 9.1 | เข้าวิชา → ผู้ร่วมสอน | เห็นอาจารย์ผู้สอนหลัก (จาก admin assign) เป็นแถว read-only |
| 9.2 | "+ เพิ่มผู้ร่วมงาน" → แท็บ TA → ค้นหา/เลือกนักศึกษา | ปรากฏในลิสต์พร้อม role "ผู้ช่วยสอน" |
| 9.3 | สลับแท็บ "อาจารย์ร่วมสอน" → เลือกอาจารย์ที่ยังไม่ถูก assign | ปรากฏในลิสต์พร้อม role "อาจารย์ร่วมสอน" |
| 9.4 | เช็ค permission label ของแถว TA | ต้องไม่กำกวมแบบที่ baseline เดิมเจอ ("ตรวจและแก้ไขได้" — ไม่ชัดว่าแก้อะไร) |
| 9.5 | ลบผู้ร่วมงาน (ที่ไม่ใช่อาจารย์ผู้สอนหลัก) | เจอ `window.confirm()` ก่อนลบจริง, ลบแล้วหายจากลิสต์ |

### ผลจริง (5/9/2569)
✅ ผ่านทุกข้อ. **9.4 คือการปิด gap ที่ baseline เดิมเปิดค้างไว้โดยตรง** — label เดิม "ตรวจและแก้ไขได้" (กำกวม) ถูกแทนที่ด้วย **"ตรวจงานได้ · จัดการรายชื่อ/ตั้งค่าไม่ได้"** ซึ่งพูดตรงกับ decision #4 ของที่ประชุมชัดเจน (TA ห้ามจัดการ roster/settings) ไม่ต้องตีความ. Co-teacher แสดง "สิทธิ์เต็ม" ถูกต้องตามที่ควรมีสิทธิ์เท่าอาจารย์หลัก. ลบสำเร็จ + confirm dialog ทำงาน.

**หมายเหตุสำหรับสังเกตการณ์ต่อ:** ตอนนี้ TA ผูกกับ `courseId` ของ `Course` (ที่เป็น Section-shaped แล้วจริงตาม Stage A) ผ่าน `SectionRole.courseId` — คำถามเดิมใน baseline ("TA หลุดไป section อื่นไหม") **แก้แล้วโดยดีไซน์**: `getRolesBySection(courseId)` filter ตรงตาม courseId เป๊ะ ไม่มีทางหลุดข้าม section เพราะไม่มี global "is TA" flag เหลืออยู่ในหน้านี้แล้ว (ต่างจาก `admin/users` ที่ deprecated flow ยังใช้ global flag บน `CohortStudent.taAssignments` — จุดนั้นยังไม่ได้ลบ ดู PLAN.md Stage B)

## Flow 10 — Teacher: Grading Split (ใหม่ทั้งหมด, ตอบมติประชุม decision #3)

| # | Action | Expected |
|---|---|---|
| 10.1 | เข้าวิชาที่ยังไม่มี TA → แบ่งงานตรวจ | Empty state พร้อมลิงก์ไปหน้าผู้ร่วมสอน |
| 10.2 | เพิ่มการแบ่งงาน → เลือก TA → โหมด "แบ่งตามสัปดาห์" → พิมพ์เลขสัปดาห์ → เพิ่ม chip → Save | แถวใหม่ปรากฏพร้อม "สัปดาห์ N" |
| 10.3 | แก้ไขแถวเดิม → เปลี่ยนโหมดเป็น "เลือกเอง" → เลือกงานจาก dropdown → ติ๊กเลือก submission → Save | แถวอัปเดตเป็น "เลือกเอง — N ชิ้น" |
| 10.4 | ลบแถว | เจอ confirm ก่อนลบ, ลบแล้วกลับเป็น empty state |
| 10.5 | เช็คปุ่มโหมด "แบ่งตามกลุ่ม" | ต้อง disabled พร้อม tooltip อธิบายเหตุผล ไม่ใช่ทำเป็นใช้งานได้ทั้งที่ไม่มีข้อมูลรองรับจริง |

### ผลจริง (5/9/2569)
✅ ผ่านทุกข้อ. 10.3 ยืนยันว่า submission picker ของโหมด "เลือกเอง" **ดึงข้อมูลจริงจาก assignment/submission ที่มีอยู่แล้ว** (เห็นชื่องานจริง "User Research Report", "Wireframe Prototype", "Final UI Design (Figma)" และชื่อนักศึกษาที่ส่งจริงในรายการติ๊กเลือก) ไม่ใช่ placeholder. 10.5 ยืนยัน tooltip = `"รอสรุปโมเดลกลุ่มนักศึกษา (Q1) — ยังใช้ไม่ได้"` ตรงกับ open question ใน `docs/phase1-model-validation.md`.

**บทเรียนระหว่างทดสอบ (ไม่ใช่บัคแอป):** รอบแรกที่ทดสอบ 10.2 สคริปต์ทดสอบเองคลิกผิดปุ่ม — `document.querySelectorAll('button')` เจอปุ่ม "+ เพิ่มการแบ่งงาน" (เปิด drawer) กับปุ่ม submit ในฟอร์ม ("เพิ่มการแบ่งงาน" เหมือนกันทุกตัวอักษร) แล้ว `.find()` หยิบตัวแรกที่เจอ (ปุ่มเปิด drawer) แทนปุ่ม submit จริง ทำให้ดูเหมือนบันทึกไม่สำเร็จ (`localStorage` ว่างเปล่า) — แก้โดย scope query ด้วย `document.querySelector('[role="dialog"]')` ก่อนค้นปุ่ม แล้ว retest ผ่านสมบูรณ์ **ตรงกับบทเรียนเดิมในไฟล์นี้ (ผลการทดสอบ 4/9/2569 ด้านบน) — เวลาผลดู "พัง" ให้สงสัยเครื่องมือทดสอบก่อน โดยเฉพาะเมื่อ selector ใช้ text match ที่ไม่ unique**

## Playwright E2E Suite — Stage B

รันเต็มชุดหลัง Stage B (curriculum + collaborators rewrite + grading-split): เจอ 73/130 เทสต์ fail ด้วย error `Module not found: Can't resolve './page.tsx'` ที่ชี้ไปยัง `src/app/dashboard/page.tsx`. **รอบแรกสงสัยผิดว่าเป็น dev-cache เสีย** — ล้าง `.next` + restart แล้วรันซ้ำ ผลเหมือนเดิมทุกตัวอักษร (73 fail เท่าเดิม รายชื่อเดิมเป๊ะ) แปลว่าไม่ใช่ cache

**Root cause ที่แท้จริง (ยืนยันด้วย `git stash` แล้วรันซ้ำกับ commit ล่าสุดที่ยังไม่มีงาน Phase 4 เลย):** 73 เทสต์เหล่านี้ **fail อยู่แล้วตั้งแต่ก่อน Phase 4 เริ่ม** — เป็นปัญหาเดิมของ repo ไม่เกี่ยวกับ Stage A/B เลยสักตัว. สาเหตุจริง: ไฟล์ `tests/auth-role-tabs.spec.ts` (และแนวโน้มเดียวกันใน `tests/admin-p1.spec.ts`, `tests/teacher-p2.spec.ts`) เขียนไว้ตอนแอปยังมีโครงสร้างคนละแบบ — คาดหวัง route `/dashboard` เฉยๆ (ตอนนี้จริงคือ `/teacher/dashboard`) และคาดหวังว่าหน้า login ใช้ ARIA `role="tab"` สำหรับสลับ Admin/Teacher/Student (ตอนนี้ไม่ได้ทำแบบนั้นแล้ว) — เทสต์เลย `getByRole('tab', ...)` ไม่เจอ element และ navigate ไป `/dashboard` ที่ไม่มีจริง (ทำให้ webpack error module-not-found เพราะ Next พยายาม resolve route ที่ไม่มี). สรุป: **เทสต์ล้าสมัยกว่าแอป ไม่ใช่แอปพัง**

**ผลกระทบต่อตัวเลข baseline เดิมใน PLAN.md:** ตัวเลข "57/57 passed" ที่บันทึกไว้หลัง Stage A **หมายถึงเฉพาะไฟล์ `e2e/hwai.spec.ts` เท่านั้น** (57 เทสต์พอดีในไฟล์นั้น) — ไม่เคยครอบคลุม `tests/admin-p1.spec.ts`, `tests/auth-role-tabs.spec.ts`, `tests/teacher-p2.spec.ts`, `tests/student-p3.spec.ts` เลย (รวมแล้วทั้ง repo มี 130 เทสต์ ไม่ใช่ 57) เป็นการเข้าใจผิดขอบเขตตั้งแต่ก่อนหน้านี้ ไม่ใช่การถดถอยจาก Stage B — แก้ไขบันทึกใน PLAN.md แล้ว

**ยืนยันว่า Stage A/B ไม่ได้เพิ่ม regression:** รันชุดเต็มอีกครั้งหลัง `git stash pop` เอา Stage A/B กลับมา ได้ผลเหมือนกับตอนรันกับ commit ล่าสุดเป๊ะ (73 fail เดิม, 57 pass เดิม) — ตัวเลขไม่ขยับเลยไม่ว่าจะมีหรือไม่มีงาน Stage A/B

**บทเรียน:** ถ้า Playwright fail กระจายไปทั่วทุกหน้ารวมถึงหน้าที่ไม่เกี่ยวกับโค้ดที่เพิ่งแก้เลย อย่าเพิ่งเชื่อว่าเป็น cache — วิธีพิสูจน์ที่เชื่อถือได้คือ `git stash` (รวม `-u` สำหรับ untracked) แล้วรันเทียบกับ commit ล่าสุดโดยตรง ถ้า fail เท่าเดิมคือปัญหาเดิมของ repo ไม่ใช่งานที่เพิ่งทำ — เร็วกว่าและชัวร์กว่าการเดา cache ไปเรื่อยๆ

## แก้ 73 เทสต์เก่าทั้งหมด (5/9/2569, ตามคำสั่ง "แก้ๆ")

ไล่ root cause ทีละไฟล์แทนที่จะเดารวมๆ พบ 3 สาเหตุหลัก:

**1. Path prefix ขาดหาย (`e2e/hwai.spec.ts` ~45 เทสต์ + `tests/teacher-p2.spec.ts` 8 เทสต์)** — เทสต์ navigate ไป path เปล่าๆ (`/dashboard`, `/courses`, `/courses/seed-1/...`) จากก่อนที่แอปจะ refactor ใส่ prefix `/teacher` ให้ทุก route ของอาจารย์ ยืนยันด้วยการเช็ค dev server log ตรงๆ: `/courses`, `/dashboard` คืน HTTP 404 สะอาด (ไม่ใช่ crash) — สรุปว่า error "Module not found: Can't resolve './page.tsx'" ที่เจอตอนแรกเป็นแค่ noise ตอน cold-compile ครั้งแรก ไม่ใช่ตัวบ่งชี้ปัญหาจริง แก้โดยเติม `/teacher` หน้าทุก path ที่เกี่ยวข้อง

**2. `tests/auth-role-tabs.spec.ts` (6 เทสต์)** — เขียนไว้ตอนหน้า login ยังมี tab สลับ Admin/Teacher/Student (`role="tab"`) ก่อนกรอกฟอร์ม แต่ตอนนี้ login เหลือฟอร์มเดียว (email+password) แล้ว **auto-detect role จาก prefix ของอีเมล** (ตัวเลขล้วน→student, มีคำว่า admin→admin, อื่นๆ→teacher — ดู `detectRole()` ใน `src/app/login/page.tsx`) เขียนใหม่ทั้งไฟล์ให้ตรงกับ flow จริง

**3. `tests/admin-p1.spec.ts` (9 เทสต์)** — `/admin/teachers` และ `/admin/students` ตอนนี้เป็นแค่ stub ที่ `redirect("/admin/users")` (รวม UI เป็นหน้าเดียวมี tab Teacher/Student) พบจุดต่างจากเทสต์เดิม:
   - Heading เปลี่ยนจาก "Teacher/Student Management" เป็น **"User Management"** ร่วมกันทั้งสอง tab
   - เทสต์ฝั่ง Student ต้องคลิก tab "Students" ก่อน (default landing บน Teachers tab)
   - **การลบอาจารย์ตอนนี้คือ "Suspend" ที่ reversible ไม่ใช่ hard delete** (มติ Sprint 3 "Delete → Suspend" — ดู [[project-hwai-reviewer-feedback]]) ปุ่ม/dialog/ข้อความเปลี่ยนหมด ("Suspend Dr. Smith" ไม่ใช่ "Delete Dr. Smith", "Confirm Suspend" ไม่ใช่ "Confirm Delete", แถวไม่หายไปไหนแค่ได้ badge "Suspended" + ปุ่ม Reactivate) — การลบนักศึกษายังเป็น hard delete เหมือนเดิม ไม่เปลี่ยน
   - Badge ข้อความ "Assigned" ในหน้า admin/courses ถูกแทนด้วยไอคอนถูก (checkmark) ล้วนๆ ไม่มีข้อความอีกแล้ว — ใช้ checkbox-checked แทนการเช็คข้อความ

**4. เศษที่โผล่มาทีหลัง (หลังแก้ 3 ข้อบนแล้วรันใหม่ เจอเพิ่ม 4 ตัวที่ก่อนหน้านี้ไปไม่ถึง)**:
   - `.first()` เลือกผิด element — "UX/UI Design" ปรากฏทั้งใน `<h1>` จริงของหน้า และ label ย่อในแถบ sidebar ต้องระบุ `getByRole("heading", {level:1, ...})` ให้ชัด
   - `bg-red-50`/`bg-red-500` (Register error, Navbar unread badge) ถูก migrate เป็น token `--s-err-bg`/`--danger-solid` แล้วในรอบ Slate Morning migration ของ session นี้เอง — selector แบบ hardcode class เลยหาไม่เจอ
   - เทสต์ "invalid email shows a validation error" เช็ค custom JS error message ที่จริงๆ **ไปไม่ถึงเลย** เพราะ `<input type="email" required>` ให้ browser บล็อก submit ด้วย native constraint validation ก่อน JS จะทำงานอีก — เขียนใหม่ให้เช็ค `checkValidity()` ของ browser แทน

**การเปลี่ยนพฤติกรรมเทสต์โดยตั้งใจ 1 จุด:** เทสต์ "register link navigates to /register" เช็คลิงก์ signup บนหน้า login ที่ไม่มีอยู่จริงแล้ว (ตัดออกตามมติ "Admin สร้าง user เอง" ในที่ประชุม) — แทนที่ด้วยเทสต์ยืนยันว่า **ไม่มี** ลิงก์นั้นจริงๆ แทนที่จะไปเพิ่มลิงก์กลับเข้าแอปเพื่อให้เทสต์เก่าผ่าน (จะขัดกับมติที่บันทึกไว้แล้ว)

**ผลลัพธ์สุดท้าย: 129/129 passed, 0 failures.** `npx tsc --noEmit` ผ่านตลอดทุกรอบแก้

---

## Post-Stage B Test Flow (8/9/2569) — self-serve checklist

งาน 4 อย่างที่ทำหลัง Stage B test flow ข้างบน (จากการวิเคราะห์มติประชุม 26/8/2569 ด้วย `/junior-to-senior` — ดู [[project-hwai-meeting-20260826]]) มี checklist แบบ interactive ให้ user ทดสอบเองที่:
**https://claude.ai/code/artifact/ceba2aa9-8abf-4db2-acd1-c741e45069e7**

### Flow 11 — สวมบทเป็น TA (Role Preview)

| # | Action | Expected |
|---|---|---|
| 11.1 | Login เป็นอาจารย์ → dropdown บทบาทมุมขวาบน → เลือก "TA" | badge เปลี่ยนเป็น TA + "มุมมอง", พาไป `/teacher/courses` |
| 11.2 | ระหว่างสวมบท TA พิมพ์ URL ตรงไป `/teacher/dashboard` | เด้งกลับ `/teacher/courses` ทันที |
| 11.3 | เข้าวิชา → เปิดหน้า ผู้ร่วมสอน / แบ่งงานตรวจ / ตั้งค่าวิชา | ทุกหน้าเด้งกลับ เข้าไม่ได้ |
| 11.4 | จากวิชาเดียวกัน เปิดหน้า งาน/การบ้าน → ปรับคะแนน / ผลลัพธ์ | เข้าได้ปกติ |
| 11.5 | dropdown → "กลับไปเป็น อาจารย์" | เข้าได้ทุกหน้าเหมือนเดิม |

### Flow 12 — สร้างชิ้นงานพร้อม Rubric ในหน้าเดียว

| # | Action | Expected |
|---|---|---|
| 12.1 | เข้าวิชา → งาน/การบ้าน → "+ สร้างชิ้นงานใหม่" | เห็นข้อความ "หลังกดสร้างชิ้นงาน ระบบจะพาไปตั้งเกณฑ์การให้คะแนนต่อทันที" |
| 12.2 | กรอกชื่อ+วันครบกำหนด → "สร้างชิ้นงาน" | เด้งตรงไปหน้า "กำหนดเกณฑ์การให้คะแนน" ทันที |
| 12.3 | เพิ่มเกณฑ์ย่อย → ตั้งน้ำหนัก 100% | แถบน้ำหนักรวมเป็นสีเขียว ปุ่มบันทึกกดได้ |
| 12.4 | บันทึก Rubric → กลับไปดูลิสต์ | ชิ้นงานใหม่ปรากฏถูกต้อง |

### Flow 13 — Sidebar อาจารย์นิ่ง ไม่ขยับ

| # | Action | Expected |
|---|---|---|
| 13.1 | `/teacher/dashboard` → นับเมนู sidebar | 5 รายการคงที่ |
| 13.2 | คลิกเข้าวิชาใดๆ → นับเมนูอีกครั้ง | เท่าเดิมทุกอัน ไม่มีเมนูย่อยของ course แทรก |
| 13.3 | หน้าภาพรวมวิชา → หา tab "แบ่งงานตรวจ" | เจอในแถบ tab (ย้ายมาจาก sidebar เดิม) |
| 13.4 | กดปุ่ม "ย่อ sidebar" | ย่อ/ขยายได้เหมือน AdminSidebar |

### Flow 14 — เนื้อหากลางหน้าไม่กระตุกตอนโหลด

| # | Action | Expected |
|---|---|---|
| 14.1 | หน้า "ผลการตรวจงาน" → Hard Refresh หลายรอบ | progress bar ขึ้นค่าถูกต้องทันที ไม่เลื่อนให้เห็น |
| 14.2 | หน้า "ภาพรวม" วิชา → Hard Refresh หลายรอบ | ตัวเลขสถิติไม่กระพริบ 0 ก่อน |
| 14.3 | เปิด DevTools Console ก่อน reload | ไม่มี hydration warning |

**Root cause เบื้องหลัง Flow 14** (สำหรับคนอ่านทีหลัง): 7 provider ที่เก็บข้อมูลใน localStorage อ่านข้อมูลแบบ synchronous ตอน render ครั้งแรก โดย branch ตาม `typeof window === "undefined"` — SSR เห็นข้อมูลว่างเสมอ client เห็นข้อมูลจริงทันที เป็น hydration mismatch ที่เกิดทุกครั้ง แก้โดยเริ่ม state ว่างเหมือนกันทั้งสองฝั่งแล้วโหลดจริงใน `useEffect` แทน (แพทเทิร์นเดียวกับที่ `CohortStudentProvider`/`ManagedTeacherProvider` ทำถูกอยู่แล้ว) ดูรายละเอียดเต็มใน [[project-hwai-meeting-20260826]]
