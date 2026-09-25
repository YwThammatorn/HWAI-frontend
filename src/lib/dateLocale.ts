/** Locale for Date#toLocale*String — follows the language toggle (some pages had "th-TH" / "en-US" hard-coded). */
export const dateLocale = (lang: string) => (lang === "th" ? "th-TH" : "en-US");
