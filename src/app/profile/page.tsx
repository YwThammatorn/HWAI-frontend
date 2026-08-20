"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

const INITIAL = {
  fullName: "Alex Teacher",
  email: "alex.teacher@school.edu",
  joinedAt: "21/05/2026",
  role: "Teacher",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label?: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={[
        "relative w-11 h-6 rounded-full transition-colors shrink-0",
        checked ? "bg-[var(--accent)]" : "bg-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-5.5" : "translate-x-0.5",
        ].join(" ")}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState(INITIAL);
  const [draft, setDraft] = useState(INITIAL);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  function startEdit() { setDraft(info); setEditing(true); }
  function cancelEdit() { setEditing(false); }
  function saveEdit() { setInfo(draft); setEditing(false); }

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords do not match"); return; }
    if (pwForm.next.length < 8) { setPwError("Password must be at least 8 characters"); return; }
    setPwError("");
    setPwSaved(true);
    setPwForm({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwSaved(false), 3000);
  }

  return (
    <AppShell>
        <main className="px-10 py-8 max-w-3xl mx-auto">

          {/* Profile Information */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-50">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Profile Information</h2>
                <p className="text-xs text-gray-500 mt-0.5">Personal details and application status.</p>
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
                  Edit Information
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
                  <p className="font-bold text-[var(--text-primary)] text-base">{info.fullName}</p>
                  <button className="text-xs text-[var(--accent)] hover:underline mt-0.5">Change avatar</button>
                </div>
              </div>

              {/* Fields */}
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                      <input
                        value={draft.fullName}
                        onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Email address</label>
                      <input
                        value={draft.email}
                        onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                        type="email"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={saveEdit} className="px-4 py-2 text-sm bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] font-semibold rounded-xl transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <Field label="Full name" value={info.fullName} />
                  <Field label="Email address" value={info.email} />
                  <Field label="Joined at" value={info.joinedAt} />
                  <Field label="Role" value={info.role} />
                </div>
              )}
            </div>
          </div>

          {/* Security & Password */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
            <div className="px-6 pt-5 pb-4 border-b border-gray-50">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Security &amp; Password</h2>
              <p className="text-xs text-gray-500 mt-0.5">Update your password and manage account security.</p>
            </div>
            <form onSubmit={handlePwSubmit} className="px-6 py-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-4">Change Password</p>
                <label className="text-xs text-gray-500 block mb-1">Current Password</label>
                <input
                  type="password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">New Password</label>
                  <input
                    type="password"
                    value={pwForm.next}
                    onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              {pwSaved && <p className="text-xs text-green-600">Password updated successfully.</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium border border-gray-200 rounded-xl text-[var(--text-primary)] hover:bg-gray-50 transition-colors"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 rounded-2xl border border-red-100 px-6 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-red-600">Danger Zone</h2>
              <p className="text-xs text-red-400 mt-0.5">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
            <button
              onClick={() => confirm("Delete your account? This cannot be undone.") && alert("Account deleted (demo)")}
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Delete Account
            </button>
          </div>

        </main>
    </AppShell>
  );
}
