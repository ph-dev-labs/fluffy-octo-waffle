import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { getTerminals } from "@/lib/catalog";
import { parseImages } from "@/lib/utils";
import { deleteContainerAction } from "@/app/admin/actions/containers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ContainerForm } from "@/components/admin/forms/ContainerForm";
import { ConfirmSubmit } from "@/components/admin/ui";

export const metadata = { title: "Edit container" };

export default async function EditContainerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const c = await db.container.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
  if (!c) notFound();
  const hasOrders = c._count.orderItems > 0;

  return (
    <>
      <AdminHeader
        title={c.title}
        back={{ href: "/admin/containers", label: "Containers" }}
        actions={
          <>
            <Link href={`/containers/${c.slug}`} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-ink-700 ring-1 ring-ink-200 hover:bg-white">
              <ExternalLink className="size-4" /> View in store
            </Link>
            <form action={deleteContainerAction.bind(null, c.id)}>
              <ConfirmSubmit message={hasOrders ? "This container has orders, so it will be hidden (archived) instead of deleted. Continue?" : "Delete this container and its photos permanently?"}>
                <Trash2 className="size-4" /> {hasOrders ? "Archive" : "Delete"}
              </ConfirmSubmit>
            </form>
          </>
        }
      />
      <ContainerForm
        terminals={await getTerminals()}
        values={{ id: c.id, title: c.title, slug: c.slug, summary: c.summary, description: c.description, size: c.size, type: c.type, condition: c.condition, terminal: c.terminal, priceKobo: c.priceKobo, stock: c.stock, featured: c.featured, active: c.active, images: parseImages(c.images) }}
      />
    </>
  );
}
