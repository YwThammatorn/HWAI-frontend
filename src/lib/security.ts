/**
 * Faculty boundary enforcement.
 * Student work must never leave the faculty without explicit per-submission consent.
 * These functions must be called before any external API (AI grading, third-party) receives submission data.
 */

export class FacultyBoundaryError extends Error {
  constructor() {
    super("งานนักศึกษาไม่ออกนอกคณะเด็ดขาด: submission does not have externalUseConsent");
    this.name = "FacultyBoundaryError";
  }
}

/** Throws FacultyBoundaryError if the submission has not consented to external use. */
export function assertMayLeaveFaculty(submission: { externalUseConsent: boolean }): never | void {
  if (!submission.externalUseConsent) {
    throw new FacultyBoundaryError();
  }
}

/** Throws FacultyBoundaryError if ANY submission in the batch has not consented. */
export function assertBatchMayLeaveFaculty(submissions: { externalUseConsent: boolean }[]): never | void {
  if (submissions.some((s) => !s.externalUseConsent)) {
    throw new FacultyBoundaryError();
  }
}
