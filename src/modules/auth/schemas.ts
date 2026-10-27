import { z } from "zod";
import { cedulaSchema } from "@/modules/access/schemas";
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) =>
        z.email().safeParse(value).success ||
        cedulaSchema.safeParse(value).success,
      "Escribe una cédula válida.",
    ),
  password: z.string().min(1).max(256),
});
