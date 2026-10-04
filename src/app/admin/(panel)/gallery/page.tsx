import { Play, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteGalleryItemAction } from "@/app/admin/actions/content";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card, ConfirmSubmit } from "@/components/admin/ui";
import { GalleryItemForm } from "@/components/admin/forms/ContentForms";
import { Badge } from "@/components/admin/badges";

export const metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  await requireAdmin();
  const items = await db.galleryItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <AdminHeader title="Gallery" description="Photos and videos shown on the Gallery page and homepage. Lower order numbers appear first." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((g) => (
            <Card key={g.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-ink-500">
                  {g.type === "video" ? <Play className="size-3.5" /> : null}{g.type} · order {g.sortOrder}
                </span>
                <div className="flex items-center gap-2">
                  {!g.active ? <Badge>hidden</Badge> : null}
                  <form action={deleteGalleryItemAction.bind(null, g.id)}>
                    <ConfirmSubmit message="Delete this item (and its file on Cloudinary)?"><Trash2 className="size-4" /></ConfirmSubmit>
                  </form>
                </div>
              </div>
              <GalleryItemForm item={g} />
            </Card>
          ))}
          {!items.length ? <p className="text-sm text-ink-500">No gallery items yet.</p> : null}
        </div>
        <Card title="Add photo or video" className="h-fit xl:sticky xl:top-8">
          <GalleryItemForm />
        </Card>
      </div>
    </>
  );
}
