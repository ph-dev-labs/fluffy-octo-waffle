import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · C-ZUCHI Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ink-50">{children}</div>;
}
