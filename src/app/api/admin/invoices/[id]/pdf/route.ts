import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadInvoice, renderInvoicePdf } from "@/lib/invoice/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/** Admin-only PDF preview/download. Drafts carry a DRAFT watermark. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const inv = await loadInvoice(id);
  if (!inv) return new NextResponse("Not found", { status: 404 });

  try {
    const pdf = await renderInvoicePdf(inv);
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${inv.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    logger.error("invoice.render_failed", { number: inv.number, error: err });
    return new NextResponse("Could not render invoice", { status: 500 });
  }
}
