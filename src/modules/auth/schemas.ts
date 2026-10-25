import { z } from "zod";
export const loginSchema = z.object({
  email: z.email("Escribe un correo válido.").max(254),
  password: z.string().min(1, "Escribe tu contraseña.").max(256),
});
