import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { InventoryCommand } from "./schemas";
export type ReceiptMetadata={storagePath:string;filename:string;mimeType:string;byteSize:number;sha256:string};
export type ReceiptLink={id:string;movementId:string;filename:string};
export async function receiptSupportReady(){
 const rows=await getDb().execute<{ready:boolean}>(sql`select to_regclass('electoral.inventory_receipts') is not null and to_regprocedure('electoral.inventory_command_with_receipts(uuid,uuid,uuid,uuid,jsonb,jsonb)') is not null as ready`);return rows[0].ready;
}
export async function saveWithReceipts(scope:AccessContext,data:InventoryCommand,files:ReceiptMetadata[]){
 const rows=await getDb().execute<{result:{id:string;paths:string[]}}>(sql`select electoral.inventory_command_with_receipts(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${JSON.stringify(data)}::jsonb,${JSON.stringify(files)}::jsonb) as result`);
 return rows[0].result;
}
export async function unusedReceiptPaths(scope:AccessContext,paths:string[]){
 const rows=await getDb().execute<{paths:string[]}>(sql`select electoral.inventory_unused_receipt_paths(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${JSON.stringify(paths)}::jsonb) as paths`);return rows[0].paths;
}
export async function readReceiptLinks(scope:AccessContext,movementIds:string[]){
 if(!movementIds.length)return [];
 try{return [...await getDb().execute<ReceiptLink>(sql`select id,movement_id as "movementId",filename from electoral.inventory_receipts where organization_id=${scope.organizationId}::uuid and canton_id=${scope.cantonId}::uuid and event_id=${scope.eventId}::uuid and movement_id in (select jsonb_array_elements_text(${JSON.stringify(movementIds)}::jsonb)::uuid) order by created_at,id`)];}
 catch(error){const e=error as {code?:string;cause?:{code?:string}};if((e.cause?.code??e.code)==="42P01")return [];throw error;}
}
export async function readReceipt(scope:AccessContext,id:string){
 const rows=await getDb().execute<ReceiptMetadata&{id:string}>(sql`select id,storage_path as "storagePath",filename,mime_type as "mimeType",byte_size as "byteSize",sha256 from electoral.inventory_receipts where id=${id}::uuid and organization_id=${scope.organizationId}::uuid and canton_id=${scope.cantonId}::uuid and event_id=${scope.eventId}::uuid limit 1`);return rows[0]??null;
}
