import "server-only";
import { z } from "zod";
import { cedulaSchema } from "./schemas";
const endpoint =
  "https://soportereal.com/herramientas/contribuyentes/v1/contribuyente";
const responseSchema = z.object({
  identificacion: cedulaSchema,
  tipoIdentificacion: z.literal("01"),
  nombre: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2)
        .max(160)
        .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    ),
});
export function nameLookupConfigured() {
  return (
    process.env.SOPORTEREAL_ENABLED === "true" &&
    Boolean(process.env.SOPORTEREAL_API_KEY?.trim())
  );
}
export async function lookupUserName(identifier: string): Promise<string> {
  const cedula = cedulaSchema.parse(identifier);
  const key = process.env.SOPORTEREAL_API_KEY?.trim();
  if (!nameLookupConfigured() || !key)
    throw new Error("Consulta de nombres sin configurar");
  try {
    const url = new URL(endpoint);
    url.searchParams.set("identificacion", cedula);
    const response = await fetch(url, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Consulta no disponible");
    const data = responseSchema.parse(await response.json());
    if (data.identificacion !== cedula)
      throw new Error("Respuesta no corresponde");
    // Se descartan todos los campos tributarios, electorales y de domicilio.
    return data.nombre;
  } catch {
    throw new Error(
      "No se pudo obtener el nombre de Soporte Real. Inténtalo más tarde.",
    );
  }
}
