"use server";
import { revalidatePath } from "next/cache";
import { uploadVehicleDocuments } from "./document-service";
export async function uploadVehicleDocumentsAction(_previous:{error:string;success:string},form:FormData){
 try{const entries=form.getAll("documents");if(entries.some(file=>!(file instanceof File)))throw new Error("Entrada inválida");await uploadVehicleDocuments(Object.fromEntries([...form].filter(([key])=>key!=="documents")),entries.filter((f):f is File=>f instanceof File&&!!f.name));}
 catch(error){const e=error as {code?:string;cause?:{code?:string}};return {success:"",error:error instanceof Error&&error.name==="VehicleDocumentError"?error.message:(e.cause?.code??e.code)==="40001"?"Los datos cambiaron. Recargá antes de guardar.":"No se pudieron confirmar los documentos. Conservá los archivos y reintentá; el identificador evita duplicar la carga."};}
 revalidatePath(`/transporte/vehiculos/${String(form.get("vehicleId"))}`);revalidatePath("/transporte");
 return {error:"",success:"Documentos guardados de forma privada. No se verificaron ni aprobaron automáticamente."};
}
