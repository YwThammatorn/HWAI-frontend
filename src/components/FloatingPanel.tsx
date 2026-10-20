"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// A link a student submitted opens in another tab (most sites refuse to be framed), and the teacher cannot grade what is in one tab from
// a page in another. So the grading part can float in its own small window — the way Google Meet's call stays on top when you switch tab
// (14/10/2569). Chrome and Edge have Document Picture-in-Picture for exactly that (a small always-on-top window you can put our own page
// in); where it does not exist, or is refused, an ordinary small popup window does the same job without staying on top.

interface PipApi { requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window> }

/** Open the floating window. Call it straight from the click: both ways need the click's user activation. Null = the browser blocked it. */
export async function openFloatingWindow({ width, height, name }: { width: number; height: number; name: string }): Promise<Window | null> {
  const pip = (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  if (pip?.requestWindow) {
    try { return await pip.requestWindow({ width, height }); } catch { /* refused here: fall back to a plain popup */ }
  }
  return window.open("", name, `popup=yes,width=${width},height=${height}`);
}

/** Give the other window what this page looks like: its stylesheets, the colour theme and the fonts. */
function copyLook(from: Document, to: Document) {
  to.documentElement.className = from.documentElement.className;
  for (const attr of ["data-theme", "lang"]) {
    const v = from.documentElement.getAttribute(attr);
    if (v) to.documentElement.setAttribute(attr, v);
  }
  to.body.className = from.body.className;
  to.body.style.margin = "0";
  Array.from(from.styleSheets).forEach((sheet) => {
    try {
      const style = to.createElement("style");
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      to.head.appendChild(style);
    } catch {
      // a stylesheet from another origin cannot be read: link to it instead
      if (sheet.href) {
        const link = to.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        to.head.appendChild(link);
      }
    }
  });
}

/**
 * Draws \`children\` inside \`target\` (the floating window) through a React portal: the state stays in this page, so a click in the small
 * window changes the same scores the page holds. Closing the window is the page's job; if the user closes it, `onClosed` says so.
 */
export default function FloatingPanel({ target, title, onClosed, children }: {
  target: Window;
  title: string;
  /** the window was closed from its own side */
  onClosed: () => void;
  children: ReactNode;
}) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    target.document.title = title;
    copyLook(document, target.document);
    const root = target.document.createElement("div");
    root.id = "hwai-floating-root";
    root.style.cssText = "height:100vh;display:flex;flex-direction:column;";
    target.document.body.appendChild(root);
    setMount(root);

    const closed = () => onClosed();
    target.addEventListener("pagehide", closed);
    const poll = window.setInterval(() => { if (target.closed) closed(); }, 500);   // a popup that was closed without a pagehide
    const leave = () => { try { target.close(); } catch { /* already gone */ } };
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("pagehide", leave);
      try { target.removeEventListener("pagehide", closed); } catch { /* window already closed */ }
      try { root.remove(); } catch { /* ditto */ }
      // closing the window is the page's job: doing it here would also close it whenever React re-runs this effect in development
    };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return mount ? createPortal(children, mount) : null;
}
