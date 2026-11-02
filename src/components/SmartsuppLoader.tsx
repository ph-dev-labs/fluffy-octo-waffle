"use client";

import { useEffect } from "react";

export function SmartsuppLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingScript = document.getElementById("smartsupp-loader-script");
    if (existingScript) return;

    const smartsupp = (window as typeof window & { _smartsupp?: { key?: string } })._smartsupp || {};
    smartsupp.key = "85a8f990ad36a98eb856b91456b32fd960b4fac7";
    (window as typeof window & { _smartsupp?: Record<string, unknown> })._smartsupp = smartsupp;

    const firstScript = document.getElementsByTagName("script")[0];
    const script = document.createElement("script");
    script.id = "smartsupp-loader-script";
    script.type = "text/javascript";
    script.charset = "utf-8";
    script.async = true;
    script.src = "https://www.smartsuppchat.com/loader.js";

    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
      return;
    }

    document.head.appendChild(script);
  }, []);

  return null;
}
