import { beforeAll,afterAll,it,expect,vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { SQL } from "drizzle-orm";
import type { AccessContext } from "@/server/authorization/context";
vi.mock("server-only",()=>({}));
vi.mock("@/server/db/client",()=>({getDb:()=>({execute:async(q:SQL)=>(await drizzle(db).execute(q)).rows})}));
import { saveWithReceipts,readReceipt,readReceiptLinks,unusedReceiptPaths,receiptSupportReady,type ReceiptMetadata } from "@/modules/inventory/receipt-repository";
import { commandSchema } from "@/modules/inventory/schemas";
const db=new PGlite();
const org="10000000-0000-4000-8000-000000000001",canton="20000000-0000-4000-8000-000000000001",event="30000000-0000-4000-8000-000000000001",admin="80000000-0000-4000-8000-000000000001",writer="80000000-0000-4000-8000-000000000002",district="80000000-0000-4000-8000-000000000003";
const scope:AccessContext={userId:writer,organizationId:org,cantonId:canton,eventId:event,role:"member",editableModules:["A01"],organizationName:"Prueba",cantonName:"Prueba",eventName:"Prueba",isDemo:true};
let item:string,warehouse:string,person:string,savedId:string,firstData:ReturnType<typeof movement>,firstFiles:ReceiptMetadata[];
async function command(data:unknown){return (await db.query<{id:string}>("select electoral.inventory_command($1,$2,$3,$4,$5::jsonb) as id",[writer,org,canton,event,JSON.stringify(data)])).rows[0].id;}
function movement(){return {operation:"movement" as const,kind:"ingreso" as const,itemId:item,quantity:10,sourceId:"",destinationId:warehouse,personId:person,occurredOn:"2020-01-01",origin:"Donación sintética",reason:"Ingreso de prueba",evidence:"Referencia escrita anterior",requestId:randomUUID()};}
function files(requestId:string,n=2){return Array.from({length:n},(_,index)=>({filename:`prueba-${index}.pdf`,storagePath:`${org}/${event}/${requestId}/${randomUUID()}.pdf`,mimeType:"application/pdf",byteSize:100,sha256:String(index+1).repeat(64)}));}
beforeAll(async()=>{
 await db.exec("create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);create role anon;create role authenticated;");
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});await db.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
 await db.query("insert into auth.users(id) values($1),($2),($3)",[admin,writer,district]);for(const actor of [admin,writer,district])await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,$3)",[org,actor,actor===admin?"admin":"member"]);
 await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A01'),($1,$4,$3,'district')",[org,writer,canton,district]);
 person=(await db.query<{id:string}>("select person_id as id from electoral.user_people where user_id=$1",[writer])).rows[0].id;
 item=await command({operation:"item",id:"",version:0,name:"Material sintético",variant:"",unit:"pieza",category:"Prueba",active:true,reason:""});warehouse=await command({operation:"location",kind:"almacen",name:"Almacén de prueba",referenceId:""});
});
afterAll(()=>db.close());
it("migra sin modificar movimientos previos y permite repetir",async()=>{await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});expect(await receiptSupportReady()).toBe(true);expect((await db.query("select id from electoral.inventory_receipts")).rows).toHaveLength(0);});
it("registra movimiento, archivos y auditoría en la misma transacción",async()=>{
 firstData=movement();firstFiles=files(firstData.requestId);const result=await saveWithReceipts(scope,commandSchema.parse(firstData),firstFiles);savedId=result.id;
 expect(result.paths.sort()).toEqual(firstFiles.map(f=>f.storagePath).sort());expect((await db.query("select id from electoral.inventory_receipts where movement_id=$1",[savedId])).rows).toHaveLength(2);
 expect((await db.query<{evidence:string}>("select evidence from electoral.inventory_movements where id=$1",[savedId])).rows[0].evidence).toBe("Referencia escrita anterior");
});
it("un reintento no duplica stock ni archivos y permite limpiar solo nuevas copias",async()=>{
 const copies=files(firstData.requestId);const result=await saveWithReceipts(scope,commandSchema.parse(firstData),copies);expect(result.id).toBe(savedId);expect(result.paths.sort()).toEqual(firstFiles.map(f=>f.storagePath).sort());
 expect((await db.query("select id from electoral.inventory_movements")).rows).toHaveLength(1);expect((await db.query("select id from electoral.inventory_receipts")).rows).toHaveLength(2);
 expect(await unusedReceiptPaths(scope,[copies[0].storagePath,firstFiles[0].storagePath])).toEqual([copies[0].storagePath]);
});
it("no cambia archivos de un movimiento ya confirmado en un reintento",async()=>{
 await expect(saveWithReceipts(scope,commandSchema.parse(firstData),files(firstData.requestId,1))).rejects.toThrow();
 const changed=files(firstData.requestId);changed[0].sha256="f".repeat(64);await expect(saveWithReceipts(scope,commandSchema.parse(firstData),changed)).rejects.toThrow();
});
it("valida cantidad, tamaño, formato, duplicados y pertenencia de rutas antes de confirmar",async()=>{
 for(const alter of [(f:ReceiptMetadata[])=>f.map(x=>({...x,byteSize:3000000})),(f:ReceiptMetadata[])=>[f[0],f[0]],(f:ReceiptMetadata[])=>f.map(x=>({...x,mimeType:"text/html"})),(f:ReceiptMetadata[])=>f.map(x=>({...x,storagePath:`otra-organizacion/${randomUUID()}.pdf`}))]){const data=movement();await expect(saveWithReceipts(scope,commandSchema.parse(data),alter(files(data.requestId)))).rejects.toThrow();}
 const data=movement();await expect(saveWithReceipts(scope,commandSchema.parse(data),files(data.requestId,4))).rejects.toThrow();expect((await db.query("select id from electoral.inventory_movements")).rows).toHaveLength(1);
});
it("si falla la metadata después del movimiento revierte stock y auditoría",async()=>{
 const data=movement();const bad=files(data.requestId);bad[1].storagePath=bad[0].storagePath;const before=(await db.query("select id from electoral.audit_logs")).rows.length;
 await expect(saveWithReceipts(scope,commandSchema.parse(data),bad)).rejects.toThrow();expect((await db.query("select id from electoral.inventory_movements")).rows).toHaveLength(1);expect((await db.query("select id from electoral.audit_logs")).rows).toHaveLength(before);
});
it("las descargas y enlaces se limitan al evento y organización",async()=>{
 const links=await readReceiptLinks(scope,[savedId]);expect(links).toHaveLength(2);expect(links[0]).not.toHaveProperty("storagePath");expect(await readReceipt(scope,links[0].id)).toMatchObject({filename:expect.any(String)});
 expect(await readReceipt({...scope,eventId:randomUUID()},links[0].id)).toBeNull();expect(await readReceipt({...scope,organizationId:randomUUID()},links[0].id)).toBeNull();
});
it("distrital sin A01 no puede adjuntar y Data API no tiene acceso",async()=>{
 const data=movement();await expect(saveWithReceipts({...scope,userId:district},commandSchema.parse(data),files(data.requestId))).rejects.toThrow();
 await db.exec("set role electoral_app");await expect(db.query("delete from electoral.inventory_receipts")).rejects.toThrow();await db.exec("reset role;set role anon");await expect(db.query("select * from electoral.inventory_receipts")).rejects.toThrow();await db.exec("reset role");
});
