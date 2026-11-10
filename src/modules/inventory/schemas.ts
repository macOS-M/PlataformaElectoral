import { z } from "zod";
const optionalId = z.union([z.guid(), z.literal("")]).default("");
const reason = z.string().trim().min(3).max(500);
const quantity = z.coerce.number().finite().min(0).max(99999999999).refine(n => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.0001);
export const kinds = ["ingreso", "transferencia", "consumo", "dano", "perdida", "robo", "baja"] as const;
export const units = ["pieza", "caja", "paquete", "docena", "metro", "litro", "kilogramo"] as const;
export const commandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("item"), id: optionalId, version: z.coerce.number().int().min(0).default(0), name: z.string().trim().min(2).max(120), variant: z.string().trim().max(100).default(""), unit: z.enum(units), category: z.string().trim().min(2).max(80), active: z.boolean(), reason: z.string().trim().max(500).default("") }),
  z.object({ operation: z.literal("location"), kind: z.enum(["almacen", "distrito", "centro", "persona"]), referenceId: optionalId, name: z.string().trim().max(160).default("") }),
  z.object({ operation: z.literal("movement"), itemId: z.guid(), kind: z.enum(kinds), quantity: quantity.refine(n => n > 0), sourceId: optionalId, destinationId: optionalId, personId: z.guid(), occurredOn: z.iso.date(), reason, origin: z.string().trim().max(160).default(""), evidence: z.string().trim().max(500).default(""), requestId: z.guid() }),
  z.object({ operation: z.literal("need"), itemId: z.guid(), locationId: z.guid(), quantity, expectedId: optionalId }),
  z.object({ operation: z.literal("decision"), movementId: z.guid(), approved: z.boolean(), reason }),
]);
export type InventoryCommand = z.infer<typeof commandSchema>;
export const filterSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), item: optionalId, location: optionalId, person: optionalId, kind: z.union([z.enum(kinds), z.literal("")]).default(""), from: z.union([z.iso.date(),z.literal("")]).default(""), to: z.union([z.iso.date(),z.literal("")]).default("") }).refine(f => !f.from || !f.to || f.from <= f.to);
export type InventoryFilters = z.infer<typeof filterSchema>;
export const labels: Record<typeof kinds[number], string> = { ingreso: "Ingreso", transferencia: "Transferencia / entrega", consumo: "Consumo", dano: "Separar material dañado", perdida: "Pérdida", robo: "Robo", baja: "Baja de material dañado" };
