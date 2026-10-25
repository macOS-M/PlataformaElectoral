import { z } from "zod";
export const centerFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  // PostgreSQL permite UUID sin versión RFC específica (incluidas semillas deterministas).
  district: z.union([z.guid(), z.literal("")]).default(""),
  status: z
    .enum(["", "borrador", "pendiente", "validado", "inactivo"])
    .default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type CenterFilters = z.infer<typeof centerFiltersSchema>;
export const PAGE_SIZE = 12;
export const statusLabels = {
  borrador: "Borrador",
  pendiente: "Pendiente de verificar",
  validado: "Validado internamente",
  inactivo: "Inactivo",
} as const;
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
