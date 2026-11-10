import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { SQL } from "drizzle-orm";
import type { AccessContext } from "@/server/authorization/context";
vi.mock("server-only",()=>({}));
vi.mock("@/server/db/client",()=>({getDb:()=>({execute:async(query:SQL)=>(await drizzle(db).execute(query)).rows})}));
import { readInventory, readHistory, command as repositoryCommand } from "@/modules/inventory/repository";
import { filterSchema, commandSchema } from "@/modules/inventory/schemas";
const db=new PGlite();
const org="10000000-0000-4000-8000-000000000001", canton="20000000-0000-4000-8000-000000000001", event="30000000-0000-4000-8000-000000000001";
const admin="80000000-0000-4000-8000-000000000001", writer="80000000-0000-4000-8000-000000000002", reader="80000000-0000-4000-8000-000000000003", districtUser="80000000-0000-4000-8000-000000000004";
let person:string, center:string, district:string, item:string, warehouse:string, destination:string;
async function command(data:Record<string,unknown>,actor=writer,scope={org,canton,event}) {
 return (await db.query<{id:string}>("select electoral.inventory_command($1,$2,$3,$4,$5::jsonb) as id",[actor,scope.org,scope.canton,scope.event,JSON.stringify(data)])).rows[0].id;
}
function movement(kind:string, quantity:number, extra:Record<string,unknown>={}) {
 return {operation:"movement",itemId:item,kind,quantity,sourceId:kind==="ingreso"?"":warehouse,destinationId:kind==="ingreso"?warehouse:kind==="transferencia"?destination:"",personId:person,occurredOn:"2020-01-01",origin:kind==="ingreso"?"Donación sintética":"",reason:"Origen o motivo sintético",evidence:"",requestId:randomUUID(),...extra};
}
async function balances(location=warehouse) {
 return (await db.query<{usable:string;damaged:string}>("select coalesce(sum(usable),0)::text as usable,coalesce(sum(damaged),0)::text as damaged from electoral.inventory_effects where item_id=$1 and location_id=$2",[item,location])).rows[0];
}
beforeAll(async()=>{
 await db.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});
 await db.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
 await db.query("insert into auth.users(id) values($1),($2),($3),($4)",[admin,writer,reader,districtUser]);
 await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin'),($1,$3,'member'),($1,$4,'member'),($1,$5,'member')",[org,admin,writer,reader,districtUser]);
 await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A01'),($1,$4,$3,'district')",[org,writer,canton,districtUser]);
 person=(await db.query<{id:string}>("select person_id as id from electoral.user_people where user_id=$1",[writer])).rows[0].id;
 center=(await db.query<{id:string}>("select id from electoral.center_elections limit 1")).rows[0].id;
 district=(await db.query<{id:string}>("select id from electoral.districts limit 1")).rows[0].id;
},30000);
afterAll(()=>db.close());
describe("Inventario SQL y repositorio",()=>{
 it("migra desde cero y permite A01 en el rol restringido",async()=>{
  await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});
  await db.exec("set role electoral_app");
  try {
   item=await command({operation:"item",name:"Bandera de prueba",variant:"Pequeña",unit:"pieza",category:"Banderas",active:true});
   warehouse=await command({operation:"location",kind:"almacen",name:"Almacén de prueba"});
   destination=await command({operation:"location",kind:"centro",referenceId:center});
   const created=await repositoryCommand({userId:writer,organizationId:org,cantonId:canton,eventId:event} as AccessContext,commandSchema.parse({operation:"item",name:"Artículo por repositorio",variant:"",unit:"pieza",category:"Prueba",active:true}));
   expect(created).toMatch(/^[0-9a-f-]{36}$/);
  } finally {await db.exec("reset role");}
 });
 it("no hereda registro de district ni acepta lector o ámbito ajeno",async()=>{
  for(const actor of [reader,districtUser])await expect(command(movement("ingreso",1),actor)).rejects.toThrow();
  await expect(command(movement("ingreso",1),writer,{org,canton:randomUUID(),event})).rejects.toThrow();
  await expect(command(movement("ingreso",1),writer,{org,canton,event:randomUUID()})).rejects.toThrow();
 });
 it("no duplica variantes, exige unidad y no mezcla fracciones de piezas",async()=>{
  await expect(command({operation:"item",name:" bandera de prueba ",variant:"pequeña",unit:"pieza",category:"Banderas",active:true})).rejects.toThrow();
  await expect(command({operation:"item",name:"Sin unidad",category:"Prueba",active:true})).rejects.toThrow();
  await expect(command(movement("ingreso",0.5))).rejects.toThrow();
  await expect(command(movement("ingreso",0))).rejects.toThrow();
  await expect(command(movement("ingreso",-2))).rejects.toThrow();
 });
 it("ingreso idempotente deja una sola recepción y rechaza reutilización distinta",async()=>{
  const data=movement("ingreso",10);const id=await command(data);
  expect(await command(data)).toBe(id);
  await expect(command({...data,quantity:11})).rejects.toThrow();
  expect(Number((await balances()).usable)).toBe(10);
 });
 it("transferencia conserva total y consumo descuenta solo el destino",async()=>{
  await command(movement("transferencia",4));
  expect(Number((await balances()).usable)).toBe(6);
  expect(Number((await balances(destination)).usable)).toBe(4);
  await command(movement("consumo",1,{sourceId:destination}));
  expect(Number((await balances(destination)).usable)).toBe(3);
 });
 it("no sobreentrega las últimas unidades y no tiene excepción libre",async()=>{
  const results=await Promise.allSettled([command(movement("consumo",4)),command(movement("consumo",4))]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(Number((await balances()).usable)).toBe(2);
  await expect(command({...movement("consumo",3),allowNegative:true},admin)).rejects.toThrow();
 });
 it("transferencia inválida revierte ambos lados y auditoría",async()=>{
  const before=await balances();const count=(await db.query("select id from electoral.audit_logs where entity='inventory'")).rows.length;
  await expect(command(movement("transferencia",1,{destinationId:randomUUID()}))).rejects.toThrow();
  expect(await balances()).toEqual(before);
  expect((await db.query("select id from electoral.audit_logs where entity='inventory'")).rows).toHaveLength(count);
 });
 it("separa daño sin baja física, rechaza aprobación A01 y baja tras admin",async()=>{
  await command(movement("dano",1));
  expect(Number((await balances()).usable)).toBe(1);expect(Number((await balances()).damaged)).toBe(1);
  const id=await command(movement("baja",1));
  expect(Number((await balances()).damaged)).toBe(1);
  await expect(command({operation:"decision",movementId:id,approved:true,reason:"Baja verificada"})).rejects.toThrow();
  await command({operation:"decision",movementId:id,approved:true,reason:"Baja verificada"},admin);
  expect(Number((await balances()).damaged)).toBe(0);
  await expect(command({operation:"decision",movementId:id,approved:true,reason:"Segundo intento"},admin)).rejects.toThrow();
 });
 it("pérdida pendiente no altera stock y aprobación revalida existencias",async()=>{
  const pending=await command(movement("perdida",1));await command(movement("consumo",1));
  await expect(command({operation:"decision",movementId:pending,approved:true,reason:"Aprobación tardía"},admin)).rejects.toThrow();
  await command({operation:"decision",movementId:pending,approved:false,reason:"Solicitud rechazada"},admin);
  expect(Number((await balances()).usable)).toBe(0);
 });
 it("admin no puede aprobar su propio ajuste",async()=>{
  await command(movement("ingreso",2));
  const id=await command(movement("robo",1),admin);
  await expect(command({operation:"decision",movementId:id,approved:true,reason:"Autoaprobación"},admin)).rejects.toThrow();
 });
 it("metas versionadas no equivalen a stock y consumo no borra entregado",async()=>{
  const input={operation:"need",itemId:item,locationId:destination,quantity:6,expectedId:""};
  const need=await command(input);await expect(command(input)).rejects.toThrow();
  await command({...input,expectedId:need,quantity:7});
  const scope={organizationId:org,cantonId:canton,eventId:event} as AccessContext;
  await db.exec("set role electoral_app");
  try {const data=await readInventory(scope,filterSchema.parse({}));expect(data.needs[0].required).toBe("7.000");expect(Number(data.needs[0].delivered)).toBe(4);expect(data.locations.find(l=>l.id===destination)?.centerId).toBe(center);expect(data.history.length).toBeGreaterThan(0);} finally {await db.exec("reset role");}
 });
 it("redistribuir resta entregado neto sin duplicar maestros",async()=>{
  await command(movement("transferencia",1,{sourceId:destination,destinationId:warehouse}));
  const data=await readInventory({organizationId:org,cantonId:canton,eventId:event} as AccessContext,filterSchema.parse({}));
  expect(Number(data.needs[0].delivered)).toBe(3);
 });
 it("inactivos conservan historia y bloquean entradas; unidad no cambia",async()=>{
  await expect(command({operation:"item",id:item,version:1,name:"Bandera de prueba",variant:"Pequeña",unit:"caja",category:"Banderas",active:true,reason:"Cambio de unidad"})).rejects.toThrow();
  await command({operation:"item",id:item,version:1,name:"Bandera de prueba",variant:"Pequeña",unit:"pieza",category:"Banderas",active:false,reason:"Fin de uso"});
  await expect(command(movement("ingreso",2))).rejects.toThrow();
  expect((await db.query("select id from electoral.inventory_movements where item_id=$1",[item])).rows.length).toBeGreaterThan(0);
 });
 it("rechaza destino o persona ajenos, futuras y evento ajeno de ubicación",async()=>{
  await expect(command({operation:"location",kind:"persona",referenceId:randomUUID()})).rejects.toThrow();
  await expect(command({operation:"location",kind:"distrito",referenceId:randomUUID()})).rejects.toThrow();
  await command({operation:"location",kind:"distrito",referenceId:district});
  await command({operation:"item",id:item,version:2,name:"Bandera de prueba",variant:"Pequeña",unit:"pieza",category:"Banderas",active:true,reason:"Reactivación de prueba"});
  await expect(command(movement("ingreso",1,{occurredOn:"2999-01-01"}))).rejects.toThrow();
  await expect(command(movement("ingreso",1,{personId:randomUUID()}))).rejects.toThrow();
  await expect(command(movement("ingreso",1,{origin:""}))).rejects.toThrow();
  const foreignOrg=randomUUID(),foreignCanton=randomUUID();
  await db.query("insert into electoral.organizations(id,name) values($1,'Organización sintética ajena')",[foreignOrg]);
  await db.query("insert into electoral.cantons(id,name) values($1,'Cantón sintético ajeno')",[foreignCanton]);
  await db.query("insert into electoral.organization_cantons(organization_id,canton_id) values($1,$2)",[foreignOrg,foreignCanton]);
  const foreignLocation=(await db.query<{id:string}>("insert into electoral.inventory_locations(organization_id,canton_id,name,kind,created_by) values($1,$2,'Almacén ajeno','almacen',$3) returning id",[foreignOrg,foreignCanton,writer])).rows[0].id;
  await expect(command(movement("transferencia",1,{destinationId:foreignLocation}))).rejects.toThrow("Ubicación ajena");
 });
 it("historial inmutable y sin escrituras directas o acceso de navegador",async()=>{
  await expect(db.exec("delete from electoral.inventory_movements")).rejects.toThrow();
  await expect(db.exec("update electoral.inventory_needs set required=0")).rejects.toThrow();
  await db.exec("set role electoral_app");
  try {await expect(db.exec("delete from electoral.inventory_items")).rejects.toThrow();await expect(db.exec("insert into electoral.inventory_decisions default values")).rejects.toThrow();}finally{await db.exec("reset role");}
  for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);try{await expect(db.exec("select * from electoral.inventory_items")).rejects.toThrow();await expect(command(movement("ingreso",1))).rejects.toThrow();}finally{await db.exec("reset role");}}
 });
 it("auditoría falla y revierte la operación completa",async()=>{
  await db.exec("create function electoral.test_inventory_audit_fail() returns trigger language plpgsql as $$ begin raise exception 'Fallo sintético'; end $$; create trigger test_inventory_audit_fail before insert on electoral.audit_logs for each row execute function electoral.test_inventory_audit_fail();");
  await expect(command({operation:"location",kind:"almacen",name:"Almacén rollback"})).rejects.toThrow();
  expect((await db.query("select id from electoral.inventory_locations where name='Almacén rollback'")).rows).toHaveLength(0);
  await db.exec("drop trigger test_inventory_audit_fail on electoral.audit_logs; drop function electoral.test_inventory_audit_fail()");
 });
 it("revocación de A01 y Auth deshabilitado niegan la siguiente escritura",async()=>{
  await db.query("delete from electoral.module_permissions where user_id=$1",[writer]);
  await expect(command({operation:"location",kind:"almacen",name:"Sin permiso"})).rejects.toThrow();
  await db.query("update auth.users set deleted_at=now() where id=$1",[admin]);
  await expect(command({operation:"location",kind:"almacen",name:"Sin sesión activa"},admin)).rejects.toThrow();
 });
});

it("actualiza desde 0010 preservando centros, personas, asignaciones y vehículos",async()=>{
 const upgrade=new PGlite();
 try {
  await upgrade.exec("create schema auth; create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz); create role anon; create role authenticated;");
  const {readMigrationFiles}=await import("drizzle-orm/migrator");
  const migrations=readMigrationFiles({migrationsFolder:"src/server/db/migrations"});
  for(const migration of migrations.slice(0,11))for(const statement of migration.sql)await upgrade.exec(statement);
  await upgrade.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
  await upgrade.query("insert into auth.users(id) values($1)",[admin]);
  await upgrade.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin')",[org,admin]);
  const oldPerson=(await upgrade.query<{id:string}>("select person_id as id from electoral.user_people where user_id=$1",[admin])).rows[0].id;
  await upgrade.query("insert into electoral.vehicles(organization_id,canton_id,plate,description,responsible_id) values($1,$2,'UPGRADE','Vehículo sintético',$3)",[org,canton,oldPerson]);
  const tables=["people","center_elections","organizational_assignments","vehicles","training_requirements","training_progress","center_area_documents"];
  const before=await Promise.all(tables.map(table=>upgrade.query(`select * from electoral.${table} order by id`)));
  for(const statement of migrations[11].sql)await upgrade.exec(statement);
  for(let i=0;i<tables.length;i++)expect((await upgrade.query(`select * from electoral.${tables[i]} order by id`)).rows).toEqual(before[i].rows);
  expect((await upgrade.query("select count(*)::int as total from electoral.inventory_items")).rows[0]).toEqual({total:0});
 }finally{await upgrade.close();}
},30000);

it("pagina historial sin truncar movimientos ni exportaciones",async()=>{
 const extraItem=randomUUID();
 await db.query("insert into electoral.inventory_items(id,organization_id,canton_id,name,unit,category) values($1,$2,$3,'Artículo paginado','pieza','Prueba')",[extraItem,org,canton]);
 await db.query("insert into electoral.inventory_movements(organization_id,canton_id,event_id,item_id,kind,quantity,destination_id,person_id,occurred_on,origin,reason,request_id,created_by) select $1,$2,$3,$4,'ingreso',1,$5,$6,'2020-01-01','Origen sintético','Movimiento paginado',gen_random_uuid(),$7 from generate_series(1,502)",[org,canton,event,extraItem,warehouse,person,writer]);
 const scope={organizationId:org,cantonId:canton,eventId:event} as AccessContext;
 const first=await readHistory(scope,filterSchema.parse({item:extraItem}));
 const second=await readHistory(scope,filterSchema.parse({item:extraItem,page:2}));
 const exported=await readHistory(scope,filterSchema.parse({item:extraItem,page:2}),10001);
 expect(first).toHaveLength(501);expect(second).toHaveLength(2);expect(exported).toHaveLength(502);
 expect(first.slice(0,500).some(m=>m.id===second[0].id)).toBe(false);
});
