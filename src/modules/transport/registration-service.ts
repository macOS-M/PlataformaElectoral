import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getAccessContext } from "@/server/authorization/context";
import { canEditModule } from "@/server/authorization/policy";
import { vehicleSchema } from "./schemas";
import { VehicleDocumentError,prepareVehicleFiles,getVehicleDocumentStorage } from "./document-service";
import * as repository from "./registration-repository";
export async function registerVehicleWithDocuments(input:unknown,files:File[]){
 const scope=await getAccessContext();if(!scope||!canEditModule(scope,"A05"))throw new VehicleDocumentError("No tenés permiso para registrar transporte.");
 const data=vehicleSchema.parse(input),fields=z.object({registrationId:z.guid(),documentCategory:z.enum(["vehiculo","conductor","otro"])}).parse(input);
 const prepared=await prepareVehicleFiles(files,`${scope.organizationId}/registrations/${fields.registrationId}`);
 if(!await repository.registrationSupportReady())throw new VehicleDocumentError("El registro conjunto con documentos todavía no está habilitado por la administración. No se guardó el vehículo.");
 const storage=await getVehicleDocumentStorage(),uploaded:string[]=[];
 const remove=async(paths:string[])=>{if(paths.length)try{await storage.remove(paths);}catch{/* Keep private unreferenced objects for reconciliation after recovery. */}};
 try{for(const file of prepared){const result=await storage.upload(file.metadata.storagePath,file.bytes,{contentType:file.metadata.mimeType,upsert:false});if(result.error)throw new VehicleDocumentError("No se pudieron cargar los archivos. No se guardó el conductor ni el vehículo.");uploaded.push(file.metadata.storagePath);}}catch(error){await remove(uploaded);throw error;}
 const manifest=prepared.map(f=>({filename:f.metadata.filename,sha256:f.metadata.sha256,mimeType:f.metadata.mimeType,byteSize:f.metadata.byteSize})).sort((a,b)=>a.filename.localeCompare(b.filename)||a.sha256.localeCompare(b.sha256));
 const hash=createHash("sha256").update(JSON.stringify({data,category:fields.documentCategory,files:manifest})).digest("hex");
 try{const saved=await repository.saveVehicleWithDocuments(scope,fields.registrationId,hash,data,fields.documentCategory,prepared.map(f=>f.metadata));await remove(uploaded.filter(path=>!saved.paths.includes(path)));return saved.id;}
 catch(error){try{await remove(await repository.unusedRegistrationPaths(scope,fields.registrationId,uploaded));}catch{/* Never remove objects whose committed state cannot be confirmed. */}throw error;}
}
