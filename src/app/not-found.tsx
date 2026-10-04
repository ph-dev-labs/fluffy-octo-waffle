import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
    <Navbar />
    <section className="container-x flex min-h-[80vh] flex-col items-center justify-center pt-28 text-center">
      <p className="font-display text-[8rem] leading-none font-extrabold text-ink-200 sm:text-[12rem]">404</p>
      <h1 className="font-display -mt-4 text-3xl font-bold">This container has shipped</h1>
      <p className="mt-3 max-w-md text-ink-500">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/browse" icon={<ArrowRight className="size-4" />}>Browse containers</ButtonLink>
        <ButtonLink href="/" variant="secondary">Home</ButtonLink>
      </div>
    </section>
    <Footer />
    </>
  );
}
