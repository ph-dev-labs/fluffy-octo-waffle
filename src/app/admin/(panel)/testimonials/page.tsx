import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { TestimonialForm } from "@/components/admin/forms/ContentForms";
import { TestimonialManager } from "@/components/admin/ContentManagers";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireAdmin();
  const items = await db.testimonial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, quote: true, name: true, role: true, sortOrder: true, active: true },
  });
  return (
    <>
      <AdminHeader title="Testimonials" description="Only publish real quotes from customers who agreed to be featured." />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_400px]">
        <TestimonialManager items={items} />
        <Card title="Add testimonial" className="h-fit xl:sticky xl:top-8">
          <TestimonialForm />
        </Card>
      </div>
    </>
  );
}
