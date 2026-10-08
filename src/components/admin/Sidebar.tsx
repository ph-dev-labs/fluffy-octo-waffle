"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Boxes, Container, ClipboardList, ExternalLink, Images, Inbox, LayoutDashboard, LogOut, Menu, MessageSquareQuote, ScrollText, Truck, UserCog, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/admin/actions/auth";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/layout/Logo";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, badgeKey: "review" },
  { href: "/admin/containers", label: "Containers", icon: Boxes },
  { href: "/admin/requests", label: "Requests", icon: Inbox, badgeKey: "requests" },
  { href: "/admin/haulage", label: "Truck hire", icon: Container, badgeKey: "haulage" },
  { href: "/admin/delivery", label: "Delivery pricing", icon: Truck },
  { href: "/admin/gallery", label: "Gallery", icon: Images },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
] as const;

const OWNER_NAV = [
  { href: "/admin/users", label: "Admin users", icon: Users },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
] as const;

interface Props {
  user: { name: string; email: string; role: string };
  badges: { review: number; requests: number; haulage: number };
}

export function Sidebar({ user, badges }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const items = [...NAV, ...(user.role === "OWNER" ? OWNER_NAV : [])];
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <LogoMark light className="h-8 w-auto" />
        <div>
          <p className="font-display text-sm font-bold text-white">C-ZUCHI</p>
          <p className="text-xs text-ink-400">Admin console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Admin">
        {items.map(({ href, label, icon: Icon, ...rest }) => {
          const badge = "badgeKey" in rest ? badges[rest.badgeKey as keyof typeof badges] : 0;
          const active = isActive(href);
          return (
            <Link key={href} href={href} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "text-white" : "text-ink-300 hover:bg-white/5 hover:text-white")}>
              {active ? <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 34 }} /> : null}
              <Icon className="relative size-4" />
              <span className="relative flex-1">{label}</span>
              {badge ? <span className="relative rounded-full bg-accent-500 px-2 text-[11px] leading-5 font-bold text-white">{badge}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-300 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-4" /> View store
        </Link>
        <Link href="/admin/account" className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/5", isActive("/admin/account") ? "text-white" : "text-ink-300")}>
          <UserCog className="size-4" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-white">{user.name}</span>
            <span className="block truncate text-xs text-ink-400">{user.role.toLowerCase()}</span>
          </span>
        </Link>
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-300 hover:bg-white/5 hover:text-white">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-ink-950 lg:block">{content}</aside>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-ink-950 px-4 py-3 lg:hidden">
        <span className="font-display text-sm font-bold text-white">C-ZUCHI Admin</span>
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg text-white hover:bg-white/10" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink-950/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-72 bg-ink-950" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
              <button onClick={() => setOpen(false)} className="absolute top-5 right-3 grid size-9 place-items-center rounded-lg text-white hover:bg-white/10" aria-label="Close menu">
                <X className="size-5" />
              </button>
              {content}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
