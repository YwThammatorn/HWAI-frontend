# Testing

## เขียน test เมื่อไหร่
- **พฤติกรรมใหม่ / เปลี่ยนพฤติกรรม** → เพิ่มหรือแก้ spec ใน `tests/` ในงานเดียวกัน (test ที่จะ fail ถ้าไม่มีการเปลี่ยนนี้)
- **แก้ bug** → เขียน test ที่ reproduce bug ก่อน (ต้อง fail), แก้, แล้วต้อง pass — กันบั๊กเดิมกลับมา
- **แก้ mock data / seed command** → test ที่อ่าน `test-data/seed-commands.txt` หรือ JSON (เช่น `section-one-program`, `mock-scores-realistic`) ต้องยังผ่าน และเพิ่ม invariant ถ้ากฎใหม่ควรถูกรักษาไว้
- ไม่ต้องเขียน test ถ้าเป็นแค่ข้อความ/สไตล์เล็กน้อย/refactor ที่ test เดิมครอบอยู่แล้ว — แต่ให้บอกเหตุผลสั้นๆ ในคำตอบ

## วิธีเขียน (ตาม pattern ที่มีอยู่)
- seed ข้อมูลด้วย `page.addInitScript` ลง localStorage ของ test เอง (ค่าคงที่ใน module ใช้ใน init script ไม่ได้ — ประกาศภายใน function)
- ใช้ `expect.poll` / web-first assertions ไม่ใช้ `waitForTimeout`
- test ต้องไม่พึ่งลำดับ/สถานะร่วมกัน (รันแบบ `fullyParallel`)
- test ที่ต้องใช้ UI เฉพาะ dev (Dev Bypass, RoleSwitcher) ให้ `test.skip(!!process.env.E2E_PROD, "...")`

## เมื่อไหร่ที่ test รันเอง (hook `.claude/hooks/stop-verify.sh`, event Stop)
รันตอนจบแต่ละรอบ ไม่ใช่ทุกครั้งที่แก้ไฟล์ และรันเฉพาะเมื่อไฟล์ที่เฝ้าอยู่เปลี่ยนจาก green ครั้งล่าสุด:
| เปลี่ยนอะไร | รันอะไร |
|---|---|
| `src/`, `public/mock-data/`, `test-data/`, `e2e/`, config, `package.json` | `tsc` + test ทั้งชุด (`npm run test:e2e:fast`) |
| แก้เฉพาะ `*.spec.ts` | `tsc` + เฉพาะ spec ที่แก้ |
| เอกสาร, `report-ui/`, อย่างอื่น | ไม่รัน |
- แดง → hook บล็อกการจบ (exit 2) ส่ง output กลับมาให้แก้ สูงสุด 3 ครั้งติด แล้วปล่อยผ่านพร้อมให้รายงานผู้ใช้
- แก้ `src` แต่ไม่มี spec เปลี่ยนเลย → เตือนครั้งเดียวให้เขียน test หรือบอกเหตุผลว่าไม่ต้อง
- รันมือ: `npm run test:e2e` (dev server, พอร์ต 3000) หรือ `npm run test:e2e:fast` (production build, เร็วกว่า ~40%, พอร์ต 3100 — เปิด `next dev` ค้างที่ 3000 ไว้ได้ ไม่ชนกัน)
- ทุก spec ใช้ `BASE` จาก `tests/base.ts` (อ่านพอร์ตจาก `E2E_PORT`) — spec ใหม่ให้ `import { BASE } from "./base"` ห้ามฝัง `localhost:3000`
- state ของ hook อยู่ใน `.claude/.last-green`, `.claude/.stop-attempts`, `.claude/.nudged` (gitignored) — ลบทิ้งเพื่อบังคับให้รันใหม่
