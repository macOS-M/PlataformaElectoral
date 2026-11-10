import { beforeAll,afterAll,it,expect,vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { SQL } from "drizzle-orm";
import type { AccessContext } from "@/server/authorization/context";
vi.mock("server-only",()=>({}));vi.mock("@/server/db/client",()=>({getDb:()=>({execute:async(q:SQL)=>(await drizzle(db).execute(q)).rows})}));
import { readVehicle,readVehicleDocuments,readVehicleDocument,saveVehicleDocuments,unusedVehiclePaths,type DocumentUpload } from "@/modules/transport/document-repository";
import { saveVehicleWithDocuments,unusedRegistrationPaths } from "@/modules/transport/registration-repository";
import { vehicleSchema } from "@/modules/transport/schemas";
const db=new PGlite();const org="10000000-0000-4000-8000-000000000001",canton="20000000-0000-4000-8000-000000000001",event="30000000-0000-4000-8000-000000000001",admin="80000000-0000-4000-8000-000000000001",operator="80000000-0000-4000-8000-000000000002",reader="80000000-0000-4000-8000-000000000003";
const scope:AccessContext={userId:operator,organizationId:org,cantonId:canton,eventId:event,role:"member",editableModules:["A05"],organizationName:"Prueba",cantonName:"Prueba",eventName:"Prueba",isDemo:true};
let vehicle:string,person:string,otherPerson:string,district:string,firstBatch:DocumentUpload,originalPaths:string[];
let registrationId:string,registeredVehicle:string,registrationPaths:string[];
const registrationData=()=>vehicleSchema.parse({id:"",version:0,plate:"TEST-REG-DOC",description:"Unidad y documentos de prueba",personId:"",personVersion:"",fullName:"Conductor de registro sintético",phone:"",email:"",active:true,districtIds:[district],centerIds:[],reason:""});
const registrationMetadata=(id:string)=>[{filename:"alta-sintetica.pdf",storagePath:`${org}/registrations/${id}/${randomUUID()}.pdf`,mimeType:"application/pdf",byteSize:100,sha256:"a".repeat(64)}];
async function prepareAuth(target:PGlite){await target.exec("create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);create role anon;create role authenticated;");}
async function submit(details="Vehículo sintético"){return (await db.query<{id:string}>("select electoral.submit_transport_request($1,$2,$3,$4,$5,$6,$7::jsonb) as id",[org,canton,event,randomUUID(),randomUUID().replaceAll("-","").repeat(2),"a".repeat(64),JSON.stringify({kind:"driver",name:"Conductor sintético",contactChannel:"correo",contact:"conductor@example.test",districtId:district,centerId:"",desiredTime:"",vehicleDetails:details})])).rows[0].id;}
async function review(receipt:string,personId:string|null,vehicleId:string|null){const request=(await db.query<{id:string}>("select id from electoral.transport_requests where receipt=$1",[receipt])).rows[0].id;await db.query("select electoral.review_transport_request($1,$2,$3,$4,$5,1,'aprobada',$6,$7,'','','Revisión sintética')",[admin,org,canton,event,request,personId,vehicleId]);return request;}
function metadata(batch:string){return [{storagePath:`${org}/${vehicle}/${batch}/${randomUUID()}.pdf`,filename:"documento-sintetico.pdf",mimeType:"application/pdf",byteSize:100,sha256:"a".repeat(64)}];}
beforeAll(async()=>{
 await prepareAuth(db);await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});await db.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
 await db.query("insert into auth.users(id) values($1),($2),($3)",[admin,operator,reader]);for(const actor of [admin,operator,reader])await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,$3)",[org,actor,actor===admin?"admin":"member"]);
 await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A05')",[org,operator,canton]);
 person=(await db.query<{id:string}>("select person_id as id from electoral.user_people where user_id=$1",[operator])).rows[0].id;otherPerson=(await db.query<{id:string}>("select person_id as id from electoral.user_people where user_id=$1",[reader])).rows[0].id;
 district=(await db.query<{id:string}>("select id from electoral.districts where canton_id=$1 limit 1",[canton])).rows[0].id;
 vehicle=(await db.query<{id:string}>("insert into electoral.vehicles(organization_id,canton_id,plate,description,responsible_id) values($1,$2,'TEST-DOC','Unidad sintética',$3) returning id",[org,canton,person])).rows[0].id;
});
afterAll(()=>db.close());
it("rechaza inscripción directa sin vehículo y no crea logística",async()=>{
 await expect(submit("")).rejects.toThrow();await expect(submit(" ")).rejects.toThrow();expect((await db.query("select id from electoral.transport_requests")).rows).toHaveLength(0);expect((await db.query("select id from electoral.vehicles")).rows).toHaveLength(1);
});
it("aprobar exige unidad y reutiliza su conductor y vínculos sin duplicar personas",async()=>{
 const receipt=await submit(),before=(await db.query("select id from electoral.people")).rows.length;
 await expect(review(receipt,null,null)).rejects.toThrow();await expect(review(receipt,otherPerson,vehicle)).rejects.toThrow();const request=await review(receipt,null,vehicle);
 expect((await db.query("select linked_person_id,linked_vehicle_id from electoral.transport_requests where id=$1",[request])).rows[0]).toEqual({linked_person_id:person,linked_vehicle_id:vehicle});expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);expect((await db.query("select id from electoral.vehicle_district_assignments where vehicle_id=$1",[vehicle])).rows).toHaveLength(1);
 expect((await db.query("select vehicle_id from electoral.transport_vehicle_status")).rows).toHaveLength(0);
});
it("documentos se vinculan a la unidad y al conductor existente sin aprobarlos",async()=>{
 firstBatch={vehicleId:vehicle,conductorId:person,batchId:randomUUID(),category:"conductor"};originalPaths=await saveVehicleDocuments(scope,firstBatch,metadata(firstBatch.batchId));
 expect((await readVehicleDocuments(scope,vehicle))[0]).toMatchObject({category:"conductor",conductorId:person});expect(await readVehicle(scope,vehicle)).toMatchObject({responsibleId:person});
});
it("reintentar lote no duplica documentos y solo limpia nuevas copias",async()=>{
 const copies=metadata(firstBatch.batchId);expect(await saveVehicleDocuments(scope,firstBatch,copies)).toEqual(originalPaths);expect(await readVehicleDocuments(scope,vehicle)).toHaveLength(1);expect(await unusedVehiclePaths(scope,vehicle,[...originalPaths,copies[0].storagePath])).toEqual([copies[0].storagePath]);
 const changed=metadata(firstBatch.batchId);changed[0].sha256="b".repeat(64);await expect(saveVehicleDocuments(scope,firstBatch,changed)).rejects.toThrow();
});
it("conductor sustituido no hereda documentos y conserva el historial anterior",async()=>{
 await db.query("update electoral.vehicles set responsible_id=$1,version=version+1 where id=$2",[otherPerson,vehicle]);
 expect((await readVehicleDocuments(scope,vehicle))[0].conductorId).toBe(person);
 const next={...firstBatch,batchId:randomUUID()};await expect(saveVehicleDocuments(scope,next,metadata(next.batchId))).rejects.toThrow();
});
it("lectura y escritura rechazan cruces de organización, cantón, unidad y permisos",async()=>{
 const docs=await readVehicleDocuments(scope,vehicle);expect(await readVehicleDocument({...scope,organizationId:randomUUID()},vehicle,docs[0].id)).toBeNull();expect(await readVehicleDocument(scope,randomUUID(),docs[0].id)).toBeNull();expect(await readVehicle({...scope,cantonId:randomUUID()},vehicle)).toBeNull();
 const batch={...firstBatch,batchId:randomUUID(),category:"vehiculo" as const};await expect(saveVehicleDocuments({...scope,userId:reader},batch,metadata(batch.batchId))).rejects.toThrow();
});
it("metadata inválida y fallos revierten todos los documentos del lote y auditoría",async()=>{
 const batch={...firstBatch,batchId:randomUUID(),category:"vehiculo" as const},files=metadata(batch.batchId);files.push({...files[0],filename:"otro.pdf",sha256:"b".repeat(64)});const before=(await db.query("select id from electoral.audit_logs")).rows.length;
 await expect(saveVehicleDocuments(scope,batch,files)).rejects.toThrow();expect(await readVehicleDocuments(scope,vehicle)).toHaveLength(1);expect((await db.query("select id from electoral.audit_logs")).rows).toHaveLength(before);
 files[0].storagePath="otra-unidad/documento.pdf";await expect(saveVehicleDocuments(scope,batch,files.slice(0,1))).rejects.toThrow();
});
it("runtime no escribe tablas ni invoca los métodos anteriores sin vehículo",async()=>{
 await db.exec("set role electoral_app");await expect(db.query("delete from electoral.vehicle_documents")).rejects.toThrow();await expect(db.query("select electoral.submit_transport_request_before_vehicle_required(null,null,null,null,null,null,null)")).rejects.toThrow();await db.exec("reset role;set role anon");await expect(db.query("select * from electoral.vehicle_documents")).rejects.toThrow();await db.exec("reset role");
});
it("actualizar 0016 conserva solicitudes históricas aprobadas sin vehículo",async()=>{
 const legacy=new PGlite();try{
  await prepareAuth(legacy);const journal=JSON.parse(await readFile("src/server/db/migrations/meta/_journal.json","utf8")) as {entries:{idx:number;tag:string}[]};for(const entry of journal.entries.filter(e=>e.idx<17))await legacy.exec(await readFile(`src/server/db/migrations/${entry.tag}.sql`,"utf8"));await legacy.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
  const oldDistrict=(await legacy.query<{id:string}>("select id from electoral.districts limit 1")).rows[0].id;const oldId=(await legacy.query<{id:string}>("insert into electoral.transport_requests(organization_id,canton_id,event_id,token,payload_hash,kind,name,contact_channel,contact,district_id,status) values($1,$2,$3,$4,$5,'driver','Solicitud histórica','correo','historico@example.test',$6,'aprobada') returning id",[org,canton,event,randomUUID(),"a".repeat(64),oldDistrict])).rows[0].id;
  await legacy.exec(await readFile("src/server/db/migrations/0017_vehicle_documents_driver_required.sql","utf8"));expect((await legacy.query("select status,vehicle_details,vehicle_required,linked_vehicle_id from electoral.transport_requests where id=$1",[oldId])).rows[0]).toEqual({status:"aprobada",vehicle_details:"",vehicle_required:false,linked_vehicle_id:null});
 }finally{await legacy.close();}
});
it("registra conductor, unidad, vínculos y documentos desde un único guardado",async()=>{
 const peopleBefore=(await db.query("select id from electoral.people")).rows.length;registrationId=randomUUID();const result=await saveVehicleWithDocuments(scope,registrationId,"c".repeat(64),registrationData(),"conductor",registrationMetadata(registrationId));registeredVehicle=result.id;registrationPaths=result.paths;
 expect((await db.query("select id from electoral.people")).rows).toHaveLength(peopleBefore+1);const driver=(await readVehicle(scope,registeredVehicle))!;expect((await readVehicleDocuments(scope,registeredVehicle))[0]).toMatchObject({category:"conductor",conductorId:driver.responsibleId});expect((await db.query("select id from electoral.vehicle_district_assignments where vehicle_id=$1",[registeredVehicle])).rows).toHaveLength(1);
});
it("reintentar no crea otro conductor/vehículo ni repite archivos",async()=>{
 const peopleBefore=(await db.query("select id from electoral.people")).rows.length;const copies=registrationMetadata(registrationId);const result=await saveVehicleWithDocuments(scope,registrationId,"c".repeat(64),registrationData(),"conductor",copies);
 expect(result).toEqual({id:registeredVehicle,paths:registrationPaths});expect(await readVehicleDocuments(scope,registeredVehicle)).toHaveLength(1);expect((await db.query("select id from electoral.people")).rows).toHaveLength(peopleBefore);expect(await unusedRegistrationPaths(scope,registrationId,[...registrationPaths,copies[0].storagePath])).toEqual([copies[0].storagePath]);
 await expect(saveVehicleWithDocuments(scope,registrationId,"d".repeat(64),{...registrationData(),plate:"MODIFICADA"},"conductor",copies)).rejects.toThrow();
});
it("un fallo en adjuntos revierte persona, vehículo, vínculos y auditoría del alta",async()=>{
 const id=randomUUID(),files=registrationMetadata(id);files.push({...files[0],filename:"otro.pdf",sha256:"b".repeat(64)});const peopleBefore=(await db.query("select id from electoral.people")).rows.length,auditBefore=(await db.query("select id from electoral.audit_logs")).rows.length;
 await expect(saveVehicleWithDocuments(scope,id,"f".repeat(64),{...registrationData(),plate:"TEST-ROLLBACK"},"conductor",files)).rejects.toThrow();expect((await db.query("select id from electoral.vehicles where plate='TEST-ROLLBACK'")).rows).toHaveLength(0);expect((await db.query("select id from electoral.people")).rows).toHaveLength(peopleBefore);expect((await db.query("select id from electoral.audit_logs")).rows).toHaveLength(auditBefore);
});
it("edición con documentos y reintento conservan la misma unidad y aplican cambios una vez",async()=>{
 const id=randomUUID(),driver=(await readVehicle(scope,registeredVehicle))!;const personVersion=(await db.query<{version:string}>("select updated_at::text as version from electoral.people where id=$1",[driver.responsibleId])).rows[0].version;
 const input={...registrationData(),id:registeredVehicle,version:1,personId:driver.responsibleId,personVersion,reason:"Edición con documentos"};const files=registrationMetadata(id);await saveVehicleWithDocuments(scope,id,"e".repeat(64),input,"vehiculo",files);await saveVehicleWithDocuments(scope,id,"e".repeat(64),input,"vehiculo",registrationMetadata(id));
 expect((await db.query<{version:number}>("select version from electoral.vehicles where id=$1",[registeredVehicle])).rows[0].version).toBe(2);expect(await readVehicleDocuments(scope,registeredVehicle)).toHaveLength(2);
});
it("el alta conjunta exige permiso y oculta sus registros de idempotencia",async()=>{
 const id=randomUUID();await expect(saveVehicleWithDocuments({...scope,userId:reader},id,"a".repeat(64),registrationData(),"vehiculo",registrationMetadata(id))).rejects.toThrow();
 await db.exec("set role electoral_app");await expect(db.query("select * from electoral.vehicle_registrations")).rejects.toThrow();await db.exec("reset role");
});
