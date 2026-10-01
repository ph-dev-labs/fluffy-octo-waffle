"use client";

// Paystack InlineJS v2. We only ever *resume* a transaction the server
// initialised (with a server-computed amount), so no public key or amount is
// ever handled in the browser.

interface PopupCallbacks {
  onSuccess?: (tx: { reference: string }) => void;
  onCancel?: () => void;
  onError?: (err: { message?: string }) => void;
  onLoad?: () => void;
}

interface PaystackPopInstance {
  resumeTransaction(accessCode: string, callbacks?: PopupCallbacks): void;
}

declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopInstance;
  }
}

const SRC = "https://js.paystack.co/v2/inline.js";
let loading: Promise<NonNullable<Window["PaystackPop"]>> | null = null;

export function loadPaystack(timeoutMs = 12_000): Promise<NonNullable<Window["PaystackPop"]>> {
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    const timer = setTimeout(() => fail(new Error("Payment window took too long to load.")), timeoutMs);
    const fail = (err: Error) => {
      clearTimeout(timer);
      script.remove();
      loading = null; // allow a later retry
      reject(err);
    };
    script.onload = () => {
      clearTimeout(timer);
      if (window.PaystackPop) resolve(window.PaystackPop);
      else fail(new Error("Payment library failed to initialise."));
    };
    script.onerror = () => fail(new Error("Couldn't load the payment window."));
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Opens the Paystack popup. If the inline script can't load (flaky network,
 * blocked by an extension), falls back to a full-page redirect to Paystack's
 * hosted checkout, which then returns to /checkout/status via callback_url.
 */
export async function openPaystack(opts: { accessCode: string; authorizationUrl: string } & PopupCallbacks) {
  try {
    const Pop = await loadPaystack();
    new Pop().resumeTransaction(opts.accessCode, {
      onSuccess: opts.onSuccess,
      onCancel: opts.onCancel,
      onError: opts.onError,
      onLoad: opts.onLoad,
    });
    return "popup" as const;
  } catch {
    window.location.assign(opts.authorizationUrl);
    return "redirect" as const;
  }
}
