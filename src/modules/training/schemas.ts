import { z } from "zod";
const optionalId = z.union([z.uuid(), z.literal("")]);
export const requirementSchema = z.object({
  positionId: z.uuid(), expectedId: optionalId, required: z.boolean(), scheduledOn: z.union([z.iso.date(), z.literal("")]),
}).refine(d => d.required || !d.scheduledOn, { message: "Un puesto sin requisito no admite fecha de capacitación." });
export const progressSchema = z.object({
  requirementId: z.uuid(), assignmentId: z.uuid(), expectedId: optionalId,
  status: z.enum(["pendiente", "convocado", "cumplido", "no_asistio"]), statusOn: z.iso.date(),
});
export type RequirementInput = z.infer<typeof requirementSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
