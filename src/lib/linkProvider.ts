import type { IconName } from "@/components/Icon";

/**
 * What a submitted link is, from its address alone (9/11/2569): the grading screen draws a preview card for it. A real screenshot of the page behind a
 * link needs a server (sites refuse to be framed), so the card shows the provider and the address instead of pretending to show the work.
 */
export interface LinkInfo {
  /** "Figma", "GitHub", … or the host name for anything else */
  label: string;
  /** a glyph of the shared icon set */
  icon: IconName;
  /** host without "www." */
  host: string;
  /** path and query, without the leading slash — "" for a bare host */
  path: string;
}

const PROVIDERS: { test: RegExp; label: string; icon: IconName }[] = [
  { test: /(^|\.)figma\.com$/, label: "Figma", icon: "palette" },
  { test: /(^|\.)canva\.com$/, label: "Canva", icon: "palette" },
  { test: /(^|\.)github\.com$|(^|\.)gitlab\.com$/, label: "GitHub", icon: "code" },
  { test: /(^|\.)youtube\.com$|^youtu\.be$/, label: "YouTube", icon: "video" },
  { test: /^drive\.google\.com$|^docs\.google\.com$/, label: "Google Drive", icon: "folder" },
  { test: /(^|\.)notion\.(so|site)$/, label: "Notion", icon: "file-text" },
];

export function linkInfo(url: string): LinkInfo {
  let host = "";
  let path = "";
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);
    host = u.hostname.replace(/^www\./, "");
    path = `${u.pathname.replace(/^\//, "")}${u.search}`.replace(/\/$/, "");
  } catch {
    host = url;
  }
  const hit = PROVIDERS.find((p) => p.test.test(host));
  return { label: hit?.label ?? (host || "Link"), icon: hit?.icon ?? "globe", host, path };
}
