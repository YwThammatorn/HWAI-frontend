"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const { t } = useLanguage();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  const roleLabel = user?.role === "teacher"
    ? t("อาจารย์", "Teacher")
    : t("ผู้ช่วยสอน (TA)", "Teaching Assistant (TA)");

  function startEdit() {
    setDraftName(fullName);
    setDraftEmail(email);
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); }

  function saveEdit() {
    setFullName(draftName);
    setEmail(draftEmail);
    setEditing(false);
    if (user) login({ ...user, name: draftName, email: draftEmail });
  }

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setPwError(t("รหัสผ่านใหม่ไม่ตรงกัน", "New passwords do not match"));
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError(t("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "Password must be at least 8 characters"));
      return;
    }
    setPwError("");
    setPwSaved(true);
    setPwForm({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwSaved(false), 3000);
  }

  return (
      <main className="px-10 py-8 max-w-3xl mx-auto">

        {/* Profile Information */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-50">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t("ข้อมูลโปรไฟล์", "Profile Information")}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t("รายละเอียดส่วนตัวและสถานะบัญชี", "Personal details and application status.")}</p>
            </div>
            {!editing && (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-nav)] text-white text-xs font-semibold rounded-xl hover:bg-[#162240] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {t("แก้ไขข้อมูล", "Edit Information")}
              </button>
            )}
          </div>

          <div className="px-6 py-5">
            {/* Avatar row */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center overflow-hidden">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-base">{fullName}</p>
                <button
                  type="button"
                  className="text-xs text-[var(--accent)] hover:underline mt-0.5"
                  title={t("เร็วๆ นี้", "Coming soon")}
                >
                  {t("เปลี่ยนรูปโปรไฟล์", "Change avatar")}
                </button>
              </div>
            </div>

            {/* Fields */}
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t("ชื่อ-นามสกุล", "Full name")}</label>
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t("อีเมลแอดเดรส", "Email address")}</label>
                    <input
                      value={draftEmail}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      type="email"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
                    {t("ยกเลิก", "Cancel")}
                  </button>
                  <button onClick={saveEdit} className="px-4 py-2 text-sm bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] font-semibold rounded-xl transition-colors">
                    {t("บันทึก", "Save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <Field label={t("ชื่อ-นามสกุล", "Full name")} value={fullName} />
                <Field label={t("อีเมลแอดเดรส", "Email address")} value={email} />
                <Field label={t("วันที่เข้าร่วม", "Joined at")} value="July 2026" />
                <Field label={t("บทบาท", "Role")} value={roleLabel} />
              </div>
            )}
          </div>
        </div>

        {/* Security & Password */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
          <div className="px-6 pt-5 pb-4 border-b border-gray-50">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t("ความปลอดภัย & รหัสผ่าน", "Security & Password")}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t("อัปเดตรหัสผ่านและจัดการความปลอดภัยของบัญชี", "Update your password and manage account security.")}</p>
          </div>
          <form onSubmit={handlePwSubmit} className="px-6 py-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t("เปลี่ยนรหัสผ่าน", "Change Password")}</p>
              <label className="text-xs text-gray-500 block mb-1">{t("รหัสผ่านปัจจุบัน", "Current Password")}</label>
              <input
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">{t("รหัสผ่านใหม่", "New Password")}</label>
                <input
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">{t("ยืนยันรหัสผ่านใหม่", "Confirm New Password")}</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
            {pwError && <p className="text-xs text-[var(--s-err-text)]">{pwError}</p>}
            {pwSaved && <p className="text-xs text-green-600">{t("อัปเดตรหัสผ่านเรียบร้อย", "Password updated successfully.")}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 text-sm font-medium border border-gray-200 rounded-xl text-[var(--text-primary)] hover:bg-gray-50 transition-colors"
              >
                {t("อัปเดตรหัสผ่าน", "Update Password")}
              </button>
            </div>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-[var(--s-err-bg)] rounded-2xl border border-[var(--s-err-bd)] px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--s-err-text)]">{t("โซนอันตราย", "Danger Zone")}</h2>
            <p className="text-xs text-[var(--s-err-text)] mt-0.5">{t("เมื่อลบบัญชีแล้วจะไม่สามารถกู้คืนได้ โปรดแน่ใจก่อนดำเนินการ", "Once you delete your account, there is no going back. Please be certain.")}</p>
          </div>
          <button
            onClick={() => {
              if (confirm(t("ลบบัญชีของคุณ? ไม่สามารถกู้คืนได้", "Delete your account? This cannot be undone."))) {
                logout();
                router.replace("/login");
              }
            }}
            className="px-5 py-2.5 bg-[var(--danger-solid)] hover:bg-[var(--danger-solid-hover)] text-[var(--danger-solid-text)] text-sm font-semibold rounded-xl transition-colors"
          >
            {t("ลบบัญชี", "Delete Account")}
          </button>
        </div>

      </main>
  );
}
