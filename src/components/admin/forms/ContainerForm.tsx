"use client";

import { useActionState } from "react";
import { saveContainerAction } from "@/app/admin/actions/containers";
import { initialState } from "@/app/admin/actions/types";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { MediaUploader } from "../MediaUploader";
import { Card, FormMessage, SubmitButton } from "../ui";

export interface ContainerFormValues {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  size: string;
  type: string;
  condition: string;
  terminal: string;
  priceKobo: number;
  stock: number;
  featured: boolean;
  active: boolean;
  images: string[];
}

export function ContainerForm({ values, terminals }: { values?: ContainerFormValues; terminals: string[] }) {
  const [state, action] = useActionState(saveContainerAction.bind(null, values?.id ?? null), initialState);
  const f = state.fields ?? {};

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="title" label="Title" required defaultValue={values?.title} error={f.title} className="sm:col-span-2" />
            <Input name="summary" label="Short summary" required defaultValue={values?.summary} maxLength={200} hint="Shown on listing cards." error={f.summary} className="sm:col-span-2" />
            <Textarea name="description" label="Description" required rows={6} defaultValue={values?.description} maxLength={5000} error={f.description} className="sm:col-span-2" />
            <Input name="slug" label="URL slug" defaultValue={values?.slug} hint="Leave blank to generate from the title." error={f.slug} />
            <Input name="terminal" label="Terminal" required defaultValue={values?.terminal} list="terminals" error={f.terminal} />
            <datalist id="terminals">{terminals.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
        </Card>
        <Card title="Photos">
          <MediaUploader name="images" folder="containers" initial={values?.images ?? []} />
          {f.images ? <p className="mt-2 text-xs font-medium text-danger-600">{f.images}</p> : null}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Specs & pricing">
          <div className="grid gap-4">
            <Select name="size" label="Size" defaultValue={values?.size ?? "20FT"} error={f.size}>
              <option value="20FT">20ft Standard</option>
              <option value="40FT">40ft Standard</option>
              <option value="40HC">40ft High Cube</option>
              <option value="45HC">45ft High Cube</option>
            </Select>
            <Select name="type" label="Type" defaultValue={values?.type ?? "DRY"} error={f.type}>
              <option value="DRY">Dry van</option>
              <option value="REEFER">Refrigerated</option>
              <option value="OPEN_TOP">Open top</option>
              <option value="FLAT_RACK">Flat rack</option>
            </Select>
            <Select name="condition" label="Condition" defaultValue={values?.condition ?? "USED"} error={f.condition}>
              <option value="NEW">Brand new (one-trip)</option>
              <option value="USED">Used</option>
              <option value="REFURBISHED">Refurbished</option>
            </Select>
            <Input name="priceNaira" type="number" min={1} step="1" label="Price (₦)" required defaultValue={values ? values.priceKobo / 100 : undefined} error={f.priceNaira} />
            <Input name="stock" type="number" min={0} step="1" label="Units in stock" required defaultValue={values?.stock ?? 1} error={f.stock} />
          </div>
        </Card>
        <Card title="Visibility">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="active" defaultChecked={values?.active ?? true} className="size-4 accent-brand-600" /> Visible in store
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="featured" defaultChecked={values?.featured ?? false} className="size-4 accent-brand-600" /> Feature on homepage
            </label>
          </div>
        </Card>
        <div className="space-y-3">
          <FormMessage state={state} />
          <SubmitButton className="h-12 w-full" pendingText="Saving…">{values?.id ? "Save changes" : "Create container"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
