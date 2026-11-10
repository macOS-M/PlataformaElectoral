import { afterAll,beforeAll,expect,it,vi } from "vitest";
import { randomUUID,createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import type { SQL } from "drizzle-orm";
import type { AccessContext } from "@/server/authorization/context";
vi.mock("server-only",()=>({}));
vi.mock("@/server/db/client",()=>({getDb:()=>({execute:async(query:SQL)=>(await drizzle(db).execute(query)).rows})}));
import { checkAvailability,readOperations,readPublicOptions,readPublicServices } from "@/modules/public-transport/repository";
const db=new PGlite();
const org="10000000-0000-4000-8000-000000000001",canton="20000000-0000-4000-8000-000000000001",event="30000000-0000-4000-8000-000000000001";
const admin="80000000-0000-4000-8000-000000000001",coordinator="80000000-0000-4000-8000-000000000002",reader="80000000-0000-4000-8000-000000000003";
const vehicle=randomUUID(),person=randomUUID(),foreign=randomUUID();
const scope:AccessContext={userId:admin,organizationId:org,cantonId:canton,eventId:event,role:"admin",editableModules:[],organizationName:"Prueba",cantonName:"Prueba",eventName:"Prueba",isDemo:true};
let district:string,otherDistrict:string,center:string,windowId:string,tripId:string;
const start="2099-11-08T09:00:00-06:00",end="2099-11-08T10:00:00-06:00";
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function payload(kind="passenger"){return {kind,name:kind==="driver"?"Transportista de prueba":"",contactChannel:kind==="driver"?"correo":"",contact:kind==="driver"?"transportista@example.test":"",districtId:district,centerId:"",desiredTime:"",vehicleDetails:kind==="driver"?"Vehículo de prueba TEST-PUBLIC":""};}
async function submit(data=payload(),token=randomUUID(),bucket=hash(randomUUID()),digest=hash(data)){
 return (await db.query<{receipt:string}>("select electoral.submit_transport_request($1,$2,$3,$4,$5,$6,$7::jsonb) receipt",[org,canton,event,token,bucket,digest,JSON.stringify(data)])).rows[0].receipt;
}
async function status(approved=true,operational="operativo",actor=admin){const version=(await db.query<{version:number}>("select version from electoral.transport_vehicle_status where vehicle_id=$1",[vehicle])).rows[0]?.version??0;return db.query("select electoral.set_transport_vehicle_status($1,$2,$3,$4,$5,$6,$7)",[actor,org,canton,vehicle,version,approved,operational]);}
async function addWindow(){return (await db.query<{id:string}>("select electoral.add_transport_window($1,$2,$3,$4,$5,$6,'2099-11-08T08:00:00-06:00','2099-11-08T18:00:00-06:00') id",[coordinator,org,canton,event,vehicle,district])).rows[0].id;}
async function trip(from=start,to=end,centerId:string|null=center,actor=coordinator){return (await db.query<{id:string}>("select electoral.add_transport_trip($1,$2,$3,$4,$5,$6,$7,$8,$9,'Ruta de prueba','Punto institucional de prueba','central@example.test') id",[actor,org,canton,event,vehicle,district,centerId,from,to])).rows[0].id;}
async function change(id:string,action:string,actor=admin,expected?:number){const version=expected??(await db.query<{version:number}>("select version from electoral.transport_service_trips where id=$1",[id])).rows[0].version;return db.query("select electoral.change_transport_trip($1,$2,$3,$4,$5,$6,$7,'Cambio de prueba')",[actor,org,canton,event,id,version,action]);}
async function requestId(receipt:string){return (await db.query<{id:string}>("select id from electoral.transport_requests where receipt=$1",[receipt])).rows[0].id;}
async function review(id:string,actor=admin,decision="aprobada",plate="",personId:string|null=null,vehicleId:string|null=null){return db.query("select electoral.review_transport_request($1,$2,$3,$4,$5,1,$6,$7,$8,$9,'Vehículo revisado de prueba','Revisión de prueba')",[actor,org,canton,event,id,decision,personId,vehicleId,plate]);}
beforeAll(async()=>{
 await db.exec("create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);create role anon;create role authenticated;");
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});
 await db.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
 await db.query("insert into auth.users(id) values($1),($2),($3)",[admin,coordinator,reader]);
 await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin'),($1,$3,'member'),($1,$4,'member')",[org,admin,coordinator,reader]);
 await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A05')",[org,coordinator,canton]);
 const ds=(await db.query<{id:string}>("select id from electoral.districts where canton_id=$1 order by id",[canton])).rows;district=ds[0].id;otherDistrict=ds[1].id;
 center=(await db.query<{id:string}>("select id from electoral.center_elections where district_id=$1 limit 1",[district])).rows[0].id;
 await db.query("insert into electoral.people(id,organization_id,full_name,email) values($1,$2,'Responsable sintético','privado@example.test')",[person,org]);
 await db.query("insert into electoral.vehicles(id,organization_id,canton_id,plate,description,responsible_id) values($1,$2,$3,'TEST-PUBLIC','Vehículo sintético',$4)",[vehicle,org,canton,person]);
 await db.query("insert into electoral.vehicle_district_assignments(vehicle_id,organization_id,canton_id,event_id,district_id) values($1,$2,$3,$4,$5)",[vehicle,org,canton,event,district]);
 await db.query("insert into electoral.vehicle_center_assignments(vehicle_id,organization_id,canton_id,event_id,center_election_id) values($1,$2,$3,$4,$5)",[vehicle,org,canton,event,center]);
});
afterAll(()=>db.close());
it("recibe solicitudes pendientes sin cédula/contacto de pasajero y no crea logística",async()=>{
 const beforePeople=(await db.query("select id from electoral.people")).rows.length;
 const receipt=await submit({...payload(),districtId:"",centerId:center,desiredTime:"13:00"});
 const [row]=(await db.query<{status:string;district_id:string;contact:string;center_id:string}>("select status,district_id,contact,center_id from electoral.transport_requests where receipt=$1",[receipt])).rows;
 expect(row).toEqual({status:"pendiente",district_id:district,contact:"",center_id:center});
 expect((await db.query("select id from electoral.people")).rows).toHaveLength(beforePeople);
 expect((await db.query("select id from electoral.vehicles")).rows).toHaveLength(1);
});
it("rechaza cruce de distrito/centro, datos extra y contactos inválidos",async()=>{
 await expect(submit({...payload(),districtId:otherDistrict,centerId:center})).rejects.toThrow();
 await expect(submit({...payload(),districtId:foreign})).rejects.toThrow();
 await expect(submit({...payload(),cedula:"dato no admitido"} as ReturnType<typeof payload>)).rejects.toThrow();
 await expect(submit({...payload("driver"),contact:"sin-dominio"})).rejects.toThrow();
});
it("es idempotente y limita cinco envíos por cliente sin almacenar IP",async()=>{
 const token=randomUUID(),bucket=hash("cliente sintético de límites"),data=payload();
 const first=await submit(data,token,bucket);
 expect(await submit(data,token,bucket)).toBe(first);
 await expect(submit({...data,desiredTime:"12:00"},token,bucket)).rejects.toThrow();
 for(let n=0;n<4;n++)await submit(data,randomUUID(),bucket);
 await expect(submit(data,randomUUID(),bucket)).rejects.toThrow();
 expect(await submit(data,token,bucket)).toBe(first);
 expect((await db.query("select id from electoral.transport_requests where token=$1",[token])).rows).toHaveLength(1);
});
it("solo admin aprueba conductor con vehículo y reutiliza su persona sin duplicarla",async()=>{
 const id=await requestId(await submit(payload("driver")));
 const before=(await db.query("select id from electoral.people")).rows.length;
 await db.exec("set role electoral_app");
 try{await expect(review(id,coordinator)).rejects.toThrow();await expect(review(id,reader)).rejects.toThrow();await expect(review(id)).rejects.toThrow();await review(id,admin,"aprobada","",null,vehicle);}finally{await db.exec("reset role");}
 const [row]=(await db.query<{status:string;linked_person_id:string;linked_vehicle_id:string}>("select status,linked_person_id,linked_vehicle_id from electoral.transport_requests where id=$1",[id])).rows;
 expect(row.status).toBe("aprobada");expect(row.linked_person_id).toBe(person);expect(row.linked_vehicle_id).toBe(vehicle);
 await expect(review(id)).rejects.toThrow();
 expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);
});
it("puede reutilizar persona/crear vehículo revisado, y un error revierte aprobación y persona",async()=>{
 const failed=await requestId(await submit(payload("driver")));
 const people=(await db.query("select id from electoral.people")).rows.length;
 await expect(review(failed,admin,"aprobada","TEST-PUBLIC")).rejects.toThrow();
 expect((await db.query("select status from electoral.transport_requests where id=$1",[failed])).rows).toEqual([{status:"pendiente"}]);
 expect((await db.query("select id from electoral.people")).rows).toHaveLength(people);
 const id=await requestId(await submit(payload("driver")));
 await review(id,admin,"aprobada","TEST-NEW",person);
 expect((await db.query("select linked_person_id from electoral.transport_requests where id=$1",[id])).rows).toEqual([{linked_person_id:person}]);
 expect((await db.query("select vehicle_id from electoral.transport_vehicle_status")).rows).toHaveLength(0);
});
it("atiende una solicitud sin reservar transporte ni crear personas",async()=>{
 const id=await requestId(await submit());
 const before=(await db.query("select id from electoral.people")).rows.length;
 await review(id,admin,"atendida");
 expect((await db.query("select status from electoral.transport_requests where id=$1",[id])).rows).toEqual([{status:"atendida"}]);
 expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);
});
it("oculta solicitudes a lectura general y Data API; admin las lee por función",async()=>{
 await db.exec("set role electoral_app");
 try{
  await expect(db.query("select * from electoral.transport_requests")).rejects.toThrow();
  await expect(db.query("select * from electoral.transport_submission_buckets")).rejects.toThrow();
  await expect(readOperations({...scope,userId:coordinator,role:"admin"},1)).rejects.toThrow();
  const data=await readOperations(scope,1);expect(data.requests.length).toBeGreaterThan(0);
  expect((await readOperations({...scope,userId:coordinator,role:"member"},1)).requests).toEqual([]);
  await expect(db.query("update electoral.transport_vehicle_status set approved=true")).rejects.toThrow();
 }finally{await db.exec("reset role");}
 for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);try{await expect(submit()).rejects.toThrow();await expect(db.query("select * from electoral.transport_requests")).rejects.toThrow();await expect(readPublicServices(scope)).rejects.toThrow();}finally{await db.exec("reset role");}}
});
it("no considera disponible un vehículo inscrito sin aprobación y horario",async()=>{
 await expect(trip()).rejects.toThrow();
 windowId=await addWindow();await expect(trip()).rejects.toThrow();
 await expect(status(true,"operativo",coordinator)).rejects.toThrow();
 await status();
 await db.exec("set role electoral_app");
 try{tripId=await trip();expect(await readPublicServices(scope)).toEqual([]);}finally{await db.exec("reset role");}
});
it("rechaza conflictos y permite intervalos adyacentes, no solapados",async()=>{
 await expect(trip("2099-11-08T09:30:00-06:00","2099-11-08T10:30:00-06:00")).rejects.toMatchObject({code:"23P01"});
 await expect(trip("2099-11-08T10:00:00-06:00","2099-11-08T11:00:00-06:00")).resolves.toBeTruthy();
 await expect(trip("2099-11-08T19:00:00-06:00","2099-11-08T20:00:00-06:00")).rejects.toThrow();
 await expect(trip("2099-11-08T12:00:00-06:00","2099-11-08T13:00:00-06:00",foreign)).rejects.toThrow();
});
it("consulta disponibilidad real contra todos los servicios y explica los conflictos",async()=>{
 await db.exec("set role electoral_app");
 try{
  const occupied=await checkAvailability(scope,{districtId:district,centerId:center,startsAt:start,endsAt:end});
  expect(occupied.find(v=>v.vehicle_id===vehicle)).toMatchObject({available:false,approved:true,has_window:true,has_binding:true,conflict_count:1});
  expect(occupied.find(v=>v.vehicle_id===vehicle)?.conflicts).toContain("Ruta de prueba");
  const free=await checkAvailability({...scope,userId:reader,role:"member"},{districtId:district,centerId:center,startsAt:"2099-11-08T12:00:00-06:00",endsAt:"2099-11-08T13:00:00-06:00"});
  expect(free.find(v=>v.vehicle_id===vehicle)).toMatchObject({available:true,conflict_count:0});
  await expect(checkAvailability({...scope,userId:foreign},{districtId:district,centerId:center,startsAt:start,endsAt:end})).rejects.toThrow();
 }finally{await db.exec("reset role");}
});
it("solo admin confirma/publica y la proyección no contiene conductor, placa ni contacto privado",async()=>{
 await expect(change(tripId,"publish",coordinator)).rejects.toThrow();
 await db.exec("set role electoral_app");
 try{await change(tripId,"publish");const services=await readPublicServices(scope,district,center);expect(services).toHaveLength(1);expect(Object.keys(services[0]).sort()).toEqual(["id","title","meeting_point","institutional_contact","starts_at","ends_at","district_id","center_id"].sort());expect(JSON.stringify(services)).not.toContain("privado@example.test");expect(JSON.stringify(services)).not.toContain("TEST-PUBLIC");}finally{await db.exec("reset role");}
 expect(await readPublicServices(scope,otherDistrict)).toEqual([]);
 expect(await readPublicServices({...scope,eventId:foreign})).toEqual([]);
 await expect(readPublicOptions({...scope,eventId:foreign})).rejects.toThrow("Ámbito público no disponible");
 await change(tripId,"unpublish");expect(await readPublicServices(scope)).toEqual([]);await change(tripId,"publish");
});
it("detecta ocupación de otro evento sin revelar el nombre de su servicio",async()=>{
 await db.exec("begin");
 try{
  await db.query("insert into electoral.election_events(id,organization_id,name) values($1,$2,'Otro evento sintético')",[foreign,org]);
  await db.query("insert into electoral.transport_service_trips(vehicle_id,organization_id,canton_id,event_id,district_id,starts_at,ends_at,title,meeting_point,created_by) values($1,$2,$3,$4,$5,'2099-11-08T12:00:00-06:00','2099-11-08T13:00:00-06:00','Nombre interno de otro evento','Punto de prueba',$6)",[vehicle,org,canton,foreign,district,admin]);
  const result=await checkAvailability(scope,{districtId:district,centerId:center,startsAt:"2099-11-08T12:00:00-06:00",endsAt:"2099-11-08T13:00:00-06:00"});
  const checked=result.find(r=>r.vehicle_id===vehicle);expect(checked?.available).toBe(false);expect(checked?.conflicts).toContain("Servicio de otro evento");expect(checked?.conflicts).not.toContain("Nombre interno de otro evento");
 }finally{await db.exec("rollback");}
});
it("retira oferta al cambiar estado operativo o vínculos y preserva las asignaciones",async()=>{
 await status(false);expect(await readPublicServices(scope)).toEqual([]);await status(true,"mantenimiento");expect(await readPublicServices(scope)).toEqual([]);await status();
 await db.query("update electoral.vehicle_center_assignments set ended_at=now() where vehicle_id=$1",[vehicle]);expect(await readPublicServices(scope)).toEqual([]);
 await db.query("update electoral.vehicle_center_assignments set ended_at=null where vehicle_id=$1",[vehicle]);expect(await readPublicServices(scope)).toHaveLength(1);
 const options=await readPublicOptions(scope);expect(options.centers.some(c=>c.id===center)).toBe(true);
});
it("cancelar deja de ofrecer ese centro y conserva registro, motivo y versiones",async()=>{
 await expect(change(tripId,"cancel",coordinator,0)).rejects.toThrow();
 await change(tripId,"cancel",coordinator);expect(await readPublicServices(scope,district,center)).toEqual([]);
 const [record]=(await db.query<{canceled_at:string;cancel_reason:string;published:boolean}>("select canceled_at::text,cancel_reason,published from electoral.transport_service_trips where id=$1",[tripId])).rows;
 expect(record.canceled_at).toBeTruthy();expect(record.cancel_reason).toBe("Cambio de prueba");expect(record.published).toBe(false);
 await expect(change(tripId,"publish")).rejects.toThrow();
 expect((await db.query("select id from electoral.vehicle_center_assignments where vehicle_id=$1",[vehicle])).rows).toHaveLength(1);
});
it("cancelar disponibilidad suspende una publicación sin borrar servicio ni ventana",async()=>{
 const id=await trip("2099-11-08T14:00:00-06:00","2099-11-08T15:00:00-06:00",null);await change(id,"publish");expect(await readPublicServices(scope)).toHaveLength(1);
 await db.query("select electoral.cancel_transport_window($1,$2,$3,$4,$5,'Cambio de disponibilidad')",[coordinator,org,canton,event,windowId]);
 expect(await readPublicServices(scope)).toEqual([]);
 expect((await db.query("select id from electoral.transport_availability_windows where id=$1 and canceled_at is not null",[windowId])).rows).toHaveLength(1);
 expect((await db.query("select id from electoral.transport_service_trips where id=$1",[id])).rows).toHaveLength(1);
});
it("la auditoría no copia contactos ni relatos y el migrador es repetible",async()=>{
 const audit=(await db.query<{after_json:unknown}>("select after_json from electoral.audit_logs where entity in ('transport_requests','transport_service_trips')")).rows;
 expect(audit.length).toBeGreaterThan(0);expect(JSON.stringify(audit)).not.toContain("transportista@example.test");
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});
});
it("el límite global protege ante rotación del identificador de navegador",async()=>{
 await db.exec("begin");
 try{
  await db.query("insert into electoral.transport_submission_buckets(key,slot,attempts) values($1,floor(extract(epoch from now())/900)::int,100) on conflict(key,slot) do update set attempts=100",[`global:${org}:${event}`]);
  await expect(submit()).rejects.toMatchObject({code:"54000"});
 }finally{await db.exec("rollback");}
});
it("si falla auditoría no persiste solicitud ni entrega un acuse de recepción",async()=>{
 const before=(await db.query("select id from electoral.transport_requests")).rows.length;
 await db.exec("create function electoral.test_transport_audit_failure() returns trigger language plpgsql as $$ begin if new.entity='transport_requests' then raise exception 'synthetic audit failure'; end if; return new; end $$;create trigger test_transport_audit_failure before insert on electoral.audit_logs for each row execute function electoral.test_transport_audit_failure();");
 try{await expect(submit()).rejects.toThrow();}finally{await db.exec("drop trigger test_transport_audit_failure on electoral.audit_logs;drop function electoral.test_transport_audit_failure();");}
 expect((await db.query("select id from electoral.transport_requests")).rows).toHaveLength(before);
});
it("actualiza desde 0012 con datos sin aprobar vehículos ni alterar centros/personas existentes",async()=>{
 const upgrade=new PGlite();
 try{
  await upgrade.exec("create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);create role anon;create role authenticated;");
  const journal=JSON.parse(await readFile("src/server/db/migrations/meta/_journal.json","utf8"));
  for(const entry of journal.entries.filter((e:{idx:number})=>e.idx<13))await upgrade.exec(await readFile(`src/server/db/migrations/${entry.tag}.sql`,"utf8"));
  await upgrade.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
  await upgrade.query("insert into electoral.people(id,organization_id,full_name) values($1,$2,'Persona sintética previa')",[person,org]);
  await upgrade.query("insert into electoral.vehicles(id,organization_id,canton_id,plate,description,responsible_id) values($1,$2,$3,'TEST-OLD','Vehículo previo',$4)",[vehicle,org,canton,person]);
  await upgrade.exec(await readFile("src/server/db/migrations/0013_public_transport.sql","utf8"));
  expect((await upgrade.query("select id from electoral.voting_centers")).rows).toHaveLength(70);
  expect((await upgrade.query("select id from electoral.people where id=$1",[person])).rows).toHaveLength(1);
  expect((await upgrade.query("select id from electoral.vehicles where id=$1",[vehicle])).rows).toHaveLength(1);
  expect((await upgrade.query("select * from electoral.transport_vehicle_status")).rows).toHaveLength(0);
  expect((await upgrade.query("select * from electoral.transport_requests")).rows).toHaveLength(0);
 }finally{await upgrade.close();}
});
