import { z } from "zod";
const optionalId = z.union([z.guid(), z.literal("")]);
export const vehicleSchema = z.object({
  id: optionalId, version: z.coerce.number().int().min(0),
  plate: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/),
  description: z.string().trim().min(2).max(160), personId: optionalId, personVersion: z.string().max(100),
  fullName: z.string().trim().min(2).max(160), phone: z.string().trim().max(40).regex(/^[+()\d .-]*$/),
  email: z.union([z.email().max(254), z.literal("")]), active: z.boolean(),
  districtIds: z.array(z.guid()).max(100), centerIds: z.array(z.guid()).max(500),
  reason: z.string().trim().max(500),
}).refine(d => !d.id || (d.version > 0 && d.reason.length >= 3), { message: "Indica el motivo del cambio." })
  .refine(d => !d.personId || !!d.personVersion, { message: "Recarga la ficha de la persona." });
export type VehicleInput = z.infer<typeof vehicleSchema>;
