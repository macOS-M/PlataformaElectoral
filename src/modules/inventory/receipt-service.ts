import "server-only";
import { createHash,randomUUID } from "node:crypto";
import { getAccessContext } from "@/server/authorization/context";
import { createAdminAuthClient } from "@/server/auth/admin";
import { identifyDocument } from "@/modules/voting-centers/area-schemas";
import { canUseInventory } from "./policy";
import { commandSchema } from "./schemas";
import { RECEIPT_BUCKET,MAX_RECEIPT_FILES,MAX_RECEIPT_BYTES } from "./receipt-policy";
import { saveWithReceipts,unusedReceiptPaths,receiptSupportReady,type ReceiptMetadata } from "./receipt-repository";
export class ReceiptError extends Error {constructor(message:string){super(message);this.name="ReceiptError";}}
export async function updateInventoryWithReceipts(input:unknown,files:File[]){
 const scope=await getAccessContext();if(!scope||!canUseInventory(scope))throw new ReceiptError("No tenés permiso para adjuntar comprobantes de inventario.");
 const data=commandSchema.parse(input);if(data.operation!=="movement")throw new ReceiptError("Los comprobantes se adjuntan a un movimiento de inventario.");
 if(!files.length||files.length>MAX_RECEIPT_FILES||files.some(f=>!f.size)||files.reduce((n,f)=>n+f.size,0)>MAX_RECEIPT_BYTES)throw new ReceiptError("Adjuntá hasta 3 archivos, con un máximo de 5 MB entre todos.");
 const prepared=await Promise.all(files.map(async file=>{
  const bytes=new Uint8Array(await file.arrayBuffer());const type=identifyDocument(bytes,file.name,file.type);
  if(!type)throw new ReceiptError("Los comprobantes deben ser archivos PDF, JPG o PNG válidos.");
  const filename=file.name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,180).trim()||`comprobante.${type.extension}`;
  const metadata:ReceiptMetadata={filename,mimeType:type.mime,byteSize:bytes.byteLength,sha256:createHash("sha256").update(bytes).digest("hex"),storagePath:`${scope.organizationId}/${scope.eventId}/${data.requestId}/${randomUUID()}.${type.extension}`};
  return {metadata,bytes};
 }));
 if(new Set(prepared.map(f=>`${f.metadata.sha256}/${f.metadata.filename}`)).size!==prepared.length)throw new ReceiptError("Eliminá los comprobantes repetidos antes de enviar.");
 if(!await receiptSupportReady())throw new ReceiptError("Los comprobantes requieren habilitar la migración 0016 antes de adjuntar archivos.");
 const client=createAdminAuthClient();const bucket=await client.storage.getBucket(RECEIPT_BUCKET);
 if(bucket.error||!bucket.data||bucket.data.public)throw new ReceiptError("El almacenamiento privado de comprobantes no está habilitado.");
 const storage=client.storage.from(RECEIPT_BUCKET);const uploaded:string[]=[];
 const remove=async(paths:string[])=>{if(paths.length)try{await storage.remove(paths);}catch{/* A failed cleanup must not erase or repeat a committed stock operation. */}};
 try{
  for(const file of prepared){const result=await storage.upload(file.metadata.storagePath,file.bytes,{contentType:file.metadata.mimeType,upsert:false});if(result.error)throw new ReceiptError("No se pudieron cargar los comprobantes. El movimiento no se confirmó.");uploaded.push(file.metadata.storagePath);}
 }catch(error){await remove(uploaded);throw error;}
 try{
  const result=await saveWithReceipts(scope,data,prepared.map(f=>f.metadata));
  await remove(uploaded.filter(path=>!result.paths.includes(path)));
  return result.id;
 }catch(error){
  // Wait for any in-flight inventory transaction before identifying unreferenced objects.
  // If the database cannot answer, retain the objects rather than deleting committed evidence.
  try{await remove(await unusedReceiptPaths(scope,uploaded));}catch{/* Retained for administrative reconciliation after connection recovery. */}
  throw error;
 }
}
