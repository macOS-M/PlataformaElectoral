import { z } from "zod";
import { getCenterArea } from "@/modules/voting-centers/area-service";
import { readAreaDocument } from "@/modules/voting-centers/area-repository";
import { DOCUMENT_BUCKET } from "@/modules/voting-centers/area-schemas";
import { createAdminAuthClient } from "@/server/auth/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; code: string; documentId: string }> }) {
  const { id, code, documentId } = await params;
  const area = await getCenterArea(id, code);
  if (!z.guid().safeParse(documentId).success) return new Response("No encontrado", { status: 404 });
  const doc = await readAreaDocument(area.scope, id, area.area.id, documentId);
  if (!doc) return new Response("No encontrado", { status: 404 });
  const { data, error } = await createAdminAuthClient().storage.from(DOCUMENT_BUCKET).download(doc.storagePath);
  if (error || !data) return new Response("No se pudo descargar el documento", { status: 503 });
  return new Response(data, { headers: { "Content-Type": doc.mimeType, "Content-Disposition": `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(doc.filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
