---
description: กฎการจัดการ context และความจำระหว่าง session ยาว
---

# Context Hygiene

## เริ่ม session
- อ่าน CLAUDE.md + HANDOFF.md (ถ้ามี) ก่อนเริ่มงานทุกครั้ง

## ระหว่างทำงาน
- Decision/convention ใหม่ → บันทึกลง CLAUDE.md ทันที ไม่รอสั่ง
- Task ที่มีผลกระทบวงกว้าง → เปิด Plan Mode ก่อนเสมอ
- Manual /compact เมื่อ context ถึง ~50% — อย่ารอ auto-compact
- Subtask ควรเล็กพอจบได้ภายใน session เดียวโดยไม่ต้อง compact กลางทาง

## จบ task ย่อย / จุดพักงาน
เขียน/อัปเดต HANDOFF.md: เป้าหมายตอนนี้ / decision ที่ทำไปแล้ว+เหตุผล / ไฟล์ที่แตะ / verify แล้ว-ยังไม่ verify / next step
Commit ทันทีที่จบแต่ละ subtask

## Knowledge gap
เจอเรื่องที่ไม่มีใน CLAUDE.md/rules/skills:
1. ห้ามเดาแล้วทำต่อเนียนๆ
2. ประกาศ: "⚠️ Knowledge gap: [X] — ต้องตรวจสอบก่อนใช้งานจริง"
3. ค้นคว้า/ถามก่อน
4. เสนอเพิ่มเข้า CLAUDE.md/rules — รอ user อนุมัติก่อนบันทึกถาวร

## Skills
- เช็ค .claude/skills/ ก่อนเริ่มงานที่เกี่ยวข้องเสมอ ไม่ต้องดูแล manifest แยก
- เพิ่ม skill ใหม่ → สร้างที่ .claude/skills/<name>/SKILL.md

## Verify before "done"
- ห้ามสรุปว่าเสร็จโดยไม่รัน test / ตรวจ git diff จริง
- มี hook (.claude/hooks/post-edit-verify.sh) บังคับรัน test อัตโนมัติอยู่แล้ว ห้ามข้าม
