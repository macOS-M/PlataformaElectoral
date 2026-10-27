import { z } from "zod";
import { modules } from "@/server/authorization/policy";
export const cedulaSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(
    z.string().regex(/^[1-9][0-9]{8}$/, "Escribe una cédula de 9 dígitos."),
  );
export const moduleSchema = z.enum(modules.map((m) => m.id));
export const authorizationSchema = z.object({
  cedula: cedulaSchema,
  role: z.enum(["admin", "member"]),
  modules: z.array(moduleSchema).max(12),
  useCode: z.literal(true),
});
export const accessSchema = z.object({
  id: z.uuid(),
  role: z.enum(["admin", "member"]),
  modules: z.array(moduleSchema).max(12),
  active: z.boolean(),
});
export const registrationSchema = z
  .object({
    fullName: z
      .union([z.string().trim().min(2).max(160), z.literal("")])
      .default(""),
    cedula: cedulaSchema,
    code: z.string().trim().min(1).max(100),
    password: z.string().min(12).max(128),
    confirmPassword: z.string().max(128),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden.",
  });

export const refreshNameSchema = z.object({
  id: z.uuid(),
  cedula: cedulaSchema,
});
