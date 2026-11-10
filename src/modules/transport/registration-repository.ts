import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { VehicleInput } from "./schemas";
import type { VehicleFileMetadata } from "./document-repository";
export async function registrationSupportReady(){const rows=await getDb().execute<{ready:boolean}>(sql`select to_regprocedure('electoral.save_vehicle_with_documents(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,jsonb)') is not null as ready`);return rows[0].ready;}
export async function saveVehicleWithDocuments(scope:AccessContext,id:string,hash:string,data:VehicleInput,category:string,files:VehicleFileMetadata[]){const rows=await getDb().execute<{result:{id:string;paths:string[]}}>(sql`select electoral.save_vehicle_with_documents(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${id}::uuid,${hash},${JSON.stringify(data)}::jsonb,${category},${JSON.stringify(files)}::jsonb) as result`);return rows[0].result;}
export async function unusedRegistrationPaths(scope:AccessContext,id:string,paths:string[]){const rows=await getDb().execute<{paths:string[]}>(sql`select electoral.unused_vehicle_registration_paths(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${id}::uuid,${JSON.stringify(paths)}::jsonb) as paths`);return rows[0].paths;}
