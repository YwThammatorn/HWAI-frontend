# LIST PAGE — MVP / ทีหลัง / ตัดออก (ฉบับสมบูรณ์)

Cross-check กับ route จริงในโค้ด (`find src/app -name page.tsx`, 4/9/2569) — ฉบับก่อนหน้าตกหล่น 10+ จอ ดู `docs/phase2-validation.md` สำหรับรายละเอียดว่าตกหล่นจุดไหนและทำไม

## Admin Portal

| จอ | สถานะ | เหตุผล |
|---|---|---|
| `/admin` | MVP | Dashboard ภาพรวม |
| `/admin/users` | MVP | รวม Teacher+Student ไว้จอเดียว (Sprint 3) |
| `/admin/courses` | MVP | จัดการรายวิชา + มอบหมายอาจารย์ |
| `/admin/teachers` | ตัดออก | legacy — รวมเข้า `/admin/users` แล้ว คงไว้จะซ้ำซ้อน |
| `/admin/students` | ตัดออก | legacy — เหตุผลเดียวกัน |
| `/admin/curriculum` (ใหม่ ยังไม่สร้าง) | MVP | จัดการ CurriculumVersion — จำเป็นสำหรับ Section model |

## Teacher Portal

| จอ | สถานะ | เหตุผล |
|---|---|---|
| `/teacher` (root redirect) | MVP | infra, ไม่ใช่หน้าจอจริง |
| `/teacher/dashboard` | MVP | ตอบคำถามข้อ 4 |
| `/teacher/courses` | MVP | รายการวิชา |
| `/teacher/courses/new` | MVP | สร้างวิชาใหม่ |
| `/teacher/courses/[id]` | MVP | ภาพรวมวิชา |
| `/teacher/courses/[id]/assignments` | MVP | รายการชิ้นงาน |
| `/teacher/courses/[id]/assignments/new` | MVP | สร้างชิ้นงาน — ตอบข้อ 1 |
| `/teacher/courses/[id]/assignments/[id]` | MVP | รายละเอียดชิ้นงาน |
| `/teacher/courses/[id]/assignments/[id]/edit` | MVP | แก้ไข rubric กลางเทอม — ตอบข้อ 2 โดยตรง |
| `/teacher/courses/[id]/assignments/[id]/grading` | MVP | หัวใจโครงงาน — ตอบข้อ 6 |
| `/teacher/courses/[id]/assignments/[id]/recheck` | MVP | เกี่ยวเนื่องข้อ 6 |
| `/teacher/courses/[id]/assignments/[id]/results` | MVP | ผลชิ้นงานระดับ assignment |
| `/teacher/courses/[id]/assignments/[id]/rubrics/[rubricId]` | MVP | Rubric editor — ตอบข้อ 1 |
| `/teacher/courses/[id]/results` | MVP | ผลรวมระดับวิชา — ตอบข้อ 3 |
| `/teacher/courses/[id]/clo` | MVP | CLO tracking — ตอบข้อ 3 ผูก Section |
| `/teacher/courses/[id]/collaborators` | MVP | จัดการ TA/co-teacher — จำเป็นสำหรับ SectionRole |
| `/teacher/courses/[id]/settings` | MVP | ต้องมี publishMode + gradingSource ต่อ Section |
| ~~`/teacher/courses/[id]/students/import`~~ → popup บนหน้า `/students` (24/9/2569) | MVP | อาจารย์เพิ่มนักศึกษาเอง (มติประชุม 4/9) |
| Grading-split config (ใหม่ ยังไม่สร้าง) | MVP | แบ่งงานตรวจ TA — PLAN.md Phase 5 |
| AI Calibration Report (ใหม่ ยังไม่สร้าง) | MVP | หัวใจโครงงาน — ตอบข้อ 7 |
| `/teacher/profile` | MVP | จำเป็นพื้นฐาน |
| `/teacher/settings` | MVP | จำเป็นพื้นฐาน (user preference, คนละอันกับ course settings) |
| `/teacher/history` | ทีหลัง | log การตรวจ/เครดิตที่ใช้ — audit trail ไม่ใช่ workflow หลัก |
| `/teacher/notifications` | ทีหลัง | nice-to-have ไม่กระทบ core grading workflow |

## Student Portal

| จอ | สถานะ | เหตุผล |
|---|---|---|
| `/student` | MVP | หน้าแรก |
| `/student/courses` | MVP | วิชาที่ลงทะเบียน |
| `/student/courses/[secId]` | MVP | ภาพรวมวิชา (เพิ่งพบว่าตกหล่นในฉบับก่อน) |
| `/student/courses/[secId]/classwork` | MVP | flow ส่งงานหลัก |
| `/student/courses/[secId]/classwork/[actId]` | MVP | submit — ตอบข้อ 8 |
| `/student/courses/[secId]/announcements` | ทีหลัง | สร้างเป็น stub แล้ว แต่ไม่กระทบ grading workflow |
| `/student/courses/[secId]/evaluation` | ทีหลัง | เหตุผลเดียวกัน |
| `/student/calendar` | MVP | ทำเสร็จแล้ว ไม่มีต้นทุนเพิ่ม |

## Auth & Compliance

| จอ | สถานะ | เหตุผล |
|---|---|---|
| `/login` | MVP | จำเป็น |
| `/register` | MVP | เพิ่งพบว่าตกหล่นในฉบับก่อน — student self-register จำเป็นถ้าไม่มี admin bulk-import ครบทุกคน |
| TA sub-role selector ที่ login | ตัดออก | role กำหนดผ่าน SectionRole แทน (memory: TA Login Deferred) |
| แจ้งการประมวลผลข้อมูล (PDPA) | ต้องตัดสินใจ | ข้อกำหนดกฎหมาย ยังไม่มี timeline จากอาจารย์ |
| ขอความยินยอมวิจัย (แยกจอ) | ต้องตัดสินใจ | อาจารย์ระบุว่าต้องคนละจอกับแจ้งประมวลผล |
| ถอนความยินยอม | ต้องตัดสินใจ | เหตุผลเดียวกัน |
