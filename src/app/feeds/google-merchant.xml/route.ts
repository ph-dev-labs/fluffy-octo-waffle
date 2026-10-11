import { db } from "@/lib/db";
import { SIZE_LABELS, TYPE_LABELS } from "@/lib/catalog";
import { siteUrl } from "@/lib/seo";
import { parseImages } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Google Merchant Center product feed (free listings). Add this URL in
// Merchant Center → Products → Feeds → "Scheduled fetch" (daily).
// Spec: https://support.google.com/merchants/answer/7052112

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const CONDITION: Record<string, string> = { NEW: "new", USED: "used", REFURBISHED: "refurbished" };

export async function GET() {
  const rows = await db.container.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  const items = rows
    .map((c) => {
      const images = parseImages(c.images);
      if (!images.length) return ""; // Google rejects items without an image
      const link = siteUrl(`/containers/${c.slug}`);
      const desc = `${c.summary} ${SIZE_LABELS[c.size] ?? c.size} ${TYPE_LABELS[c.type]?.toLowerCase() ?? ""} shipping container at ${c.terminal}, Nigeria. Free inspection, nationwide delivery.`;
      return `
    <item>
      <g:id>${esc(c.slug)}</g:id>
      <g:title>${esc(c.title.slice(0, 150))}</g:title>
      <g:description>${esc(desc.slice(0, 5000))}</g:description>
      <g:link>${esc(link)}</g:link>
      <g:image_link>${esc(images[0]!)}</g:image_link>
${images.slice(1, 10).map((u) => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join("\n")}
      <g:availability>${c.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>${(c.priceKobo / 100).toFixed(2)} NGN</g:price>
      <g:condition>${CONDITION[c.condition] ?? "used"}</g:condition>
      <g:brand>C-ZUCHI</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>Business &amp; Industrial &gt; Material Handling</g:google_product_category>
      <g:product_type>Shipping containers &gt; ${esc(SIZE_LABELS[c.size] ?? c.size)}</g:product_type>
      <g:custom_label_0>${esc(c.size)}</g:custom_label_0>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>C-ZUCHI shipping containers</title>
    <link>${esc(siteUrl("/"))}</link>
    <description>Shipping containers for sale in Nigeria</description>${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
