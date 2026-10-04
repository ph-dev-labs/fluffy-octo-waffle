import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteTestimonialAction } from "@/app/admin/actions/content";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card, ConfirmSubmit } from "@/components/admin/ui";
import { TestimonialForm } from "@/components/admin/forms/ContentForms";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireAdmin();
  const items = await db.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <AdminHeader title="Testimonials" description="Only publish real quotes from customers who agreed to be featured." />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          {items.map((t) => (
            <Card key={t.id} action={<form action={deleteTestimonialAction.bind(null, t.id)}><ConfirmSubmit message="Delete this testimonial?"><Trash2 className="size-4" /></ConfirmSubmit></form>} title={t.name}>
              <TestimonialForm t={t} />
            </Card>
          ))}
          {!items.length ? <p className="text-sm text-ink-500">No testimonials yet — the section is hidden on the site until you add one.</p> : null}
        </div>
        <Card title="Add testimonial" className="h-fit xl:sticky xl:top-8"><TestimonialForm /></Card>
      </div>
    </>
  );
}
