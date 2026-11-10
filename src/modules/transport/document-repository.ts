import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
export type VehicleFileMetadata={storagePath:string;filename:string;mimeType:string;byteSize:number;sha256:string};
export type VehicleDocument={id:string;filename:string;category:"vehiculo"|"conductor"|"otro";byteSize:number;createdAt:string;conductorId:string|null;conductorName:string|null};
export type DocumentUpload={vehicleId:string;conductorId:string;batchId:string;category:VehicleDocument["category"]};
export async function readVehicle(scope:AccessContext,id:string){
 const rows=await getDb().execute<{id:string;plate:string;description:string;responsibleId:string;active:boolean;conductorName:string;phone:string|null;email:string|null}>(sql`select v.id,v.plate,v.description,v.responsible_id as "responsibleId",v.active,p.full_name as "conductorName",p.phone,p.email from electoral.vehicles v join electoral.people p on p.id=v.responsible_id and p.organization_id=v.organization_id where v.id=${id}::uuid and v.organization_id=${scope.organizationId}::uuid and v.canton_id=${scope.cantonId}::uuid limit 1`);return rows[0]??null;
}
export async function documentSupportReady(){const rows=await getDb().execute<{ready:boolean}>(sql`select to_regclass('electoral.vehicle_documents') is not null and to_regprocedure('electoral.add_vehicle_documents(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb)') is not null as ready`);return rows[0].ready;}
export async function readVehicleDocuments(scope:AccessContext,vehicleId:string){
 return [...await getDb().execute<VehicleDocument>(sql`select d.id,d.filename,d.category,d.byte_size as "byteSize",d.created_at::text as "createdAt",d.conductor_id as "conductorId",p.full_name as "conductorName" from electoral.vehicle_documents d left join electoral.people p on p.id=d.conductor_id and p.organization_id=d.organization_id where d.vehicle_id=${vehicleId}::uuid and d.organization_id=${scope.organizationId}::uuid and d.canton_id=${scope.cantonId}::uuid order by d.created_at desc,d.id`)];
}
export async function readVehicleDocument(scope:AccessContext,vehicleId:string,id:string){
 const rows=await getDb().execute<VehicleFileMetadata&{id:string}>(sql`select id,storage_path as "storagePath",filename,mime_type as "mimeType",byte_size as "byteSize",sha256 from electoral.vehicle_documents where id=${id}::uuid and vehicle_id=${vehicleId}::uuid and organization_id=${scope.organizationId}::uuid and canton_id=${scope.cantonId}::uuid limit 1`);return rows[0]??null;
}
export async function saveVehicleDocuments(scope:AccessContext,data:DocumentUpload,files:VehicleFileMetadata[]){const rows=await getDb().execute<{paths:string[]}>(sql`select electoral.add_vehicle_documents(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${data.vehicleId}::uuid,${data.conductorId}::uuid,${data.batchId}::uuid,${data.category},${JSON.stringify(files)}::jsonb) as paths`);return rows[0].paths;}
export async function unusedVehiclePaths(scope:AccessContext,vehicleId:string,paths:string[]){const rows=await getDb().execute<{paths:string[]}>(sql`select electoral.unused_vehicle_document_paths(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${vehicleId}::uuid,${JSON.stringify(paths)}::jsonb) as paths`);return rows[0].paths;}
