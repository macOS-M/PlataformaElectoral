import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { randomUUID,createHash } from "node:crypto";
import { getAccessContext } from "@/server/authorization/context";
import { canEditModule } from "@/server/authorization/policy";
import { createAdminAuthClient } from "@/server/auth/admin";
import { identifyDocument } from "@/modules/voting-centers/area-schemas";
import * as repository from "./document-repository";
import { VEHICLE_DOCUMENT_BUCKET,MAX_VEHICLE_DOCUMENT_BYTES,MAX_VEHICLE_DOCUMENTS } from "./document-policy";
const uploadSchema=z.object({vehicleId:z.guid(),conductorId:z.guid(),batchId:z.guid(),category:z.enum(["vehiculo","conductor","otro"])});
export class VehicleDocumentError extends Error{constructor(message:string){super(message);this.name="VehicleDocumentError";}}
export async function prepareVehicleFiles(files:File[],prefix:string){
 if(!files.length||files.length>MAX_VEHICLE_DOCUMENTS||files.some(f=>!f.size)||files.reduce((n,f)=>n+f.size,0)>MAX_VEHICLE_DOCUMENT_BYTES)throw new VehicleDocumentError("Adjuntá hasta 3 archivos, con un máximo de 5 MB entre todos.");
 const prepared=await Promise.all(files.map(async file=>{const bytes=new Uint8Array(await file.arrayBuffer());const type=identifyDocument(bytes,file.name,file.type);if(!type)throw new VehicleDocumentError("Adjuntá archivos PDF, JPG o PNG válidos.");return {bytes,metadata:{filename:file.name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,180).trim()||`documento.${type.extension}`,storagePath:`${prefix}/${randomUUID()}.${type.extension}`,mimeType:type.mime,byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")}};}));
 if(new Set(prepared.map(f=>`${f.metadata.sha256}/${f.metadata.filename}`)).size!==prepared.length)throw new VehicleDocumentError("Eliminá los archivos repetidos antes de guardar.");
 return prepared;
}
export async function getVehicleDocumentStorage(){
 const client=createAdminAuthClient();const bucket=await client.storage.getBucket(VEHICLE_DOCUMENT_BUCKET);if(bucket.error||!bucket.data||bucket.data.public)throw new VehicleDocumentError("El almacenamiento privado de documentos de transporte no está habilitado.");
 return client.storage.from(VEHICLE_DOCUMENT_BUCKET);
}
export async function getVehicleDetail(id:string){
 const scope=await getAccessContext();if(!scope||!z.guid().safeParse(id).success)notFound();
 const vehicle=await repository.readVehicle(scope,id);if(!vehicle)notFound();
 const canManage=canEditModule(scope,"A05");const ready=canManage?await repository.documentSupportReady():false;
 return {vehicle,canManage,ready,documents:ready?await repository.readVehicleDocuments(scope,id):[]};
}
export async function getVehicleDocument(vehicleId:string,documentId:string){
 const scope=await getAccessContext();if(!scope||!canEditModule(scope,"A05")||!z.guid().safeParse(vehicleId).success||!z.guid().safeParse(documentId).success)return null;
 return repository.readVehicleDocument(scope,vehicleId,documentId);
}
export async function uploadVehicleDocuments(input:unknown,files:File[]){
 const scope=await getAccessContext();if(!scope||!canEditModule(scope,"A05"))throw new VehicleDocumentError("No tenés permiso para gestionar documentos de transporte.");
 const data=uploadSchema.parse(input);const vehicle=await repository.readVehicle(scope,data.vehicleId);if(!vehicle)throw new VehicleDocumentError("El vehículo no está disponible en tu ámbito.");
 if(data.category==="conductor"&&vehicle.responsibleId!==data.conductorId)throw new VehicleDocumentError("El conductor cambió. Recargá la ficha antes de adjuntar.");
 const prepared=await prepareVehicleFiles(files,`${scope.organizationId}/${vehicle.id}/${data.batchId}`);
 if(!await repository.documentSupportReady())throw new VehicleDocumentError("La carga de documentos de transporte todavía no está habilitada por la administración.");
 const storage=await getVehicleDocumentStorage(),uploaded:string[]=[];
 const remove=async(paths:string[])=>{if(paths.length)try{await storage.remove(paths);}catch{/* Keep private objects for reconciliation rather than risking committed evidence. */}};
 try{for(const file of prepared){const result=await storage.upload(file.metadata.storagePath,file.bytes,{contentType:file.metadata.mimeType,upsert:false});if(result.error)throw new VehicleDocumentError("No se pudieron cargar los documentos. No se confirmó ningún adjunto.");uploaded.push(file.metadata.storagePath);}}catch(error){await remove(uploaded);throw error;}
 try{const saved=await repository.saveVehicleDocuments(scope,data,prepared.map(f=>f.metadata));await remove(uploaded.filter(path=>!saved.includes(path)));}
 catch(error){try{await remove(await repository.unusedVehiclePaths(scope,vehicle.id,uploaded));}catch{/* Wait for connection recovery; never remove potentially referenced documents. */}throw error;}
}
