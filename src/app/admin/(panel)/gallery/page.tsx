import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { GalleryItemForm } from "@/components/admin/forms/ContentForms";
import { GalleryManager } from "@/components/admin/ContentManagers";

export const metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  await requireAdmin();
  const items = await db.galleryItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, type: true, url: true, caption: true, sortOrder: true, active: true },
  });
  return (
    <>
      <AdminHeader title="Gallery" description="Photos and videos shown on the Gallery page and homepage. Lower order numbers appear first." />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <GalleryManager items={items} />
        <Card title="Add photo or video" className="h-fit xl:sticky xl:top-8">
          <GalleryItemForm />
        </Card>
      </div>
    </>
  );
}
