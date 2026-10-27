import { z } from "zod";
const optionalId = z.union([z.uuid(), z.literal("")]);
export const personSchema = z
  .object({
    id: optionalId,
    version: z.string().max(100),
    fullName: z.string().trim().min(2).max(160),
    email: z.union([z.email().max(254), z.literal("")]),
    phone: z
      .string()
      .trim()
      .max(40)
      .regex(/^[+()\d\s.-]*$/),
    notes: z.string().trim().max(1000),
  })
  .refine((data) => !data.id || Boolean(data.version), {
    message: "Recarga la ficha antes de editar.",
  });
export const assignmentSchema = z
  .object({
    positionId: z.uuid(),
    personId: optionalId,
    expectedId: optionalId,
    reason: z.string().trim().max(500),
  })
  .refine((data) => !data.expectedId || data.reason.length >= 3, {
    message: "Indica el motivo de la sustitución o finalización.",
  });
export type PersonInput = z.infer<typeof personSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
