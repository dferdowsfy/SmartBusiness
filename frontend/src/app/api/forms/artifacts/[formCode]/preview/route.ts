// Developer/admin mapping preview: the real artifact with every mapping
// boundary drawn on it, so coordinate overlays can be validated visually.
// GET -> application/pdf
import { isCurrentUserAdmin } from "../../../../../../lib/admin";
import { generateMappingPreview } from "../../../../../forms/artifacts/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ formCode: string }> }) {
  if (!(await isCurrentUserAdmin())) return Response.json({ error: "forbidden" }, { status: 403 });
  const { formCode } = await ctx.params;
  try {
    const bytes = await generateMappingPreview(formCode);
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${formCode}-mapping-preview.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
