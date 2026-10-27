import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES } from "../src/modules/voting-centers/area-schemas";
config({ path: ".env.local", quiet: true });
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !publicKey) throw new Error("Configuración incompleta");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const options = { public: false, fileSizeLimit: MAX_DOCUMENT_BYTES, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"] };
  const bucket = await client.storage.getBucket(DOCUMENT_BUCKET);
  const setup = bucket.data ? await client.storage.updateBucket(DOCUMENT_BUCKET, options) : await client.storage.createBucket(DOCUMENT_BUCKET, options);
  if (setup.error) throw new Error("No se pudo preparar almacenamiento");
  const check = await client.storage.getBucket(DOCUMENT_BUCKET);
  if (!check.data || check.data.public) throw new Error("El bucket debe ser privado");
  if (process.argv.includes("--verify")) {
    const path = `verification/${randomUUID()}.pdf`;
    const data = new TextEncoder().encode("%PDF-1.4\n% Prueba temporal sin datos personales\n%%EOF");
    const storage = client.storage.from(DOCUMENT_BUCKET);
    try {
      if ((await storage.upload(path, data, { contentType: "application/pdf" })).error) throw new Error("Carga de prueba falló");
      const downloaded = await storage.download(path);
      if (downloaded.error || !downloaded.data || await downloaded.data.text() !== new TextDecoder().decode(data)) throw new Error("Descarga de prueba falló");
      const anonymous = createClient(url, publicKey, { auth: { persistSession: false } });
      if (!(await anonymous.storage.from(DOCUMENT_BUCKET).download(path)).error) throw new Error("Acceso anónimo inesperado");
    } finally {
      if ((await storage.remove([path])).error) throw new Error("No se pudo limpiar la prueba");
    }
  }
  console.log("Almacenamiento privado preparado" + (process.argv.includes("--verify") ? "; carga, descarga, bloqueo anónimo y limpieza verificados." : "."));
}
main().catch(() => { console.error("No se pudo preparar o verificar el almacenamiento privado. Revisa la configuración y los permisos de Storage."); process.exitCode = 1; });
