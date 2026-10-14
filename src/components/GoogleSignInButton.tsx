"use client";

import { useEffect, useRef, useState } from "react";

// Google Identity Services ("Sign in with Google"), loaded from Google's own script. The button hands
// back an ID token (`credential`) — HWAI-backend verifies it (POST /api/auth/google), never the page.
const GSI_SRC = "https://accounts.google.com/gsi/client";

interface GsiApi {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        hd?: string;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GsiApi;
  }
}

let loading: Promise<GsiApi> | null = null;
function loadGsi(): Promise<GsiApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google sign-in did not load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Google sign-in did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export default function GoogleSignInButton({
  clientId,
  domain,
  lang,
  onCredential,
  onError,
}: {
  clientId: string;
  /** Workspace domain hint — Google pre-selects that domain's accounts (the backend still checks). */
  domain?: string;
  lang: "th" | "en";
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    loadGsi().then(
      (google) => {
        if (cancelled || !ref.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => callback.current(r.credential),
          ...(domain && { hd: domain }),
          ux_mode: "popup",
          auto_select: false,
        });
        google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          logo_alignment: "center",
          width: Math.min(400, ref.current.clientWidth || 400),
          locale: lang,
        });
      },
      (err: Error) => {
        if (cancelled) return;
        setFailed(true);
        onError(err.message);
      },
    );
    return () => {
      cancelled = true;
    };
    // onError only reports a load failure once; re-rendering the button for it isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, domain, lang]);

  if (failed) return null;
  return <div ref={ref} className="flex justify-center min-h-[44px]" />;
}
