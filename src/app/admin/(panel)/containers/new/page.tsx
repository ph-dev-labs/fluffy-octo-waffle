import { requireAdmin } from "@/lib/auth/session";
import { getTerminals } from "@/lib/catalog";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ContainerForm } from "@/components/admin/forms/ContainerForm";

export const metadata = { title: "New container" };

export default async function NewContainerPage() {
  await requireAdmin();
  return (
    <>
      <AdminHeader title="New container" back={{ href: "/admin/containers", label: "Containers" }} />
      <ContainerForm terminals={await getTerminals()} />
    </>
  );
}
