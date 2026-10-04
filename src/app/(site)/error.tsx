"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook up Sentry / your error tracker here.
    console.error(error);
  }, [error]);

  return (
    <section className="container-x flex min-h-[80vh] flex-col items-center justify-center pt-28 text-center">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-ink-500">
        An unexpected error occurred. If you were making a payment, it is safe — we confirm every payment directly with Paystack.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-ink-400">Error ID: {error.digest}</p> : null}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset} icon={<RotateCw className="size-4" />}>Try again</Button>
        <ButtonLink href="/" variant="secondary">Home</ButtonLink>
      </div>
    </section>
  );
}
