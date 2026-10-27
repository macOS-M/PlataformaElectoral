import { z } from "zod";

export const areaCodeSchema = z.enum(["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09"]);
export const responsibleSchema = z.object({
  centerId: z.guid(), areaCode: areaCodeSchema,
  expectedId: z.union([z.guid(), z.literal("")]),
  personId: z.union([z.guid(), z.literal("")]),
  version: z.string().max(100),
  fullName: z.string().trim().min(2).max(160),
  email: z.union([z.email().max(254), z.literal("")]),
  phone: z.string().trim().max(40),
  notes: z.string().trim().max(2000),
  reason: z.string().trim().max(500),
});
export const documentSchema = z.object({ centerId: z.guid(), areaCode: areaCodeSchema, category: z.enum(["contrato", "cedula", "otro"]) });
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_BUCKET = "center-area-documents";
export const areaDescriptions: Record<z.infer<typeof areaCodeSchema>, string> = {
  A01: "Banderas, camisetas y materiales",
  A02: "Mujeres, juventud y otros sectores",
  A03: "Comunidades, barrios y enlaces locales",
  A04: "Fiscales, centros y juntas receptoras",
  A05: "Vehículos, rutas y logística",
  A06: "Suministros, entregas y distribución",
  A07: "Coordinación de la jornada electoral",
  A08: "Publicaciones, contenido y canales digitales",
  A09: "Trámites y comunicaciones electorales",
};

// Se comprueba contenido, extensión y MIME; no se admiten HTML, SVG ni ejecutables.
export function identifyDocument(bytes: Uint8Array, filename: string, mime: string) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) return null;
  const head = bytes.subarray(0, 8);
  if (/\.pdf$/i.test(filename) && mime === "application/pdf" && new TextDecoder().decode(head.subarray(0, 5)) === "%PDF-") return { mime: "application/pdf", extension: "pdf" };
  if (/\.jpe?g$/i.test(filename) && mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  if (/\.png$/i.test(filename) && mime === "image/png" && head.length === 8 && head.every((b, i) => b === [137,80,78,71,13,10,26,10][i])) return { mime: "image/png", extension: "png" };
  return null;
}
