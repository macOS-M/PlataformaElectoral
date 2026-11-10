import { beforeAll,afterAll,it,expect,vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import type { SQL } from "drizzle-orm";
import type { AccessContext } from "@/server/authorization/context";
vi.mock("server-only",()=>({}));
vi.mock("@/server/db/client",()=>({getDb:()=>({execute:async(q:SQL)=>(await drizzle(db).execute(q)).rows})}));
import { readCenterTraining } from "@/modules/training/center-repository";
const db=new PGlite();
const org="10000000-0000-4000-8000-000000000001",canton="20000000-0000-4000-8000-000000000001",event="30000000-0000-4000-8000-000000000001",admin="80000000-0000-4000-8000-000000000001",member="80000000-0000-4000-8000-000000000002";
let centers:string[],area:string,person:string,assignment:string,otherAssignment:string,requirement:string;
const scope:AccessContext={userId:admin,organizationId:org,cantonId:canton,eventId:event,role:"admin",editableModules:[],organizationName:"Organización sintética",cantonName:"Cantón de prueba",eventName:"Evento de prueba",isDemo:true};
async function configure(center=centers[0],expected:string|null=null,date:string|null="2020-01-01",actor=admin){return (await db.query<{id:string}>("select electoral.save_center_training_requirement($1,$2,$3,$4,$5,$6,$7,true,$8) as id",[actor,org,canton,event,center,area,expected,date])).rows[0].id;}
async function progress(req=requirement,assigned=assignment,expected:string|null=null,status="cumplido",actor=admin,center=centers[0]){return (await db.query<{id:string}>("select electoral.record_center_training_progress($1,$2,$3,$4,$5,$6,$7,$8,$9,'2020-01-01') as id",[actor,org,canton,event,center,req,assigned,expected,status])).rows[0].id;}
beforeAll(async()=>{
 await db.exec("create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);create role anon;create role authenticated;");
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});await db.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
 await db.query("insert into auth.users(id) values($1),($2)",[admin,member]);
 await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,'admin'),($1,$3,'member')",[org,admin,member]);
 await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A05')",[org,member,canton]);
 centers=(await db.query<{id:string}>("select id from electoral.center_elections order by id limit 2")).rows.map(x=>x.id);
 area=(await db.query<{id:string}>("select id from electoral.functional_areas where code='A05'")).rows[0].id;
 person=(await db.query<{id:string}>("select person_id as id from electoral.user_people where user_id=$1",[admin])).rows[0].id;
 for(const center of centers)await db.query("insert into electoral.center_area_assignments(organization_id,event_id,center_election_id,area_id,person_id,created_by) values($1,$2,$3,$4,$5,$6)",[org,event,center,area,person,admin]);
 assignment=(await db.query<{id:string}>("select id from electoral.center_area_assignments where center_election_id=$1",[centers[0]])).rows[0].id;
 otherAssignment=(await db.query<{id:string}>("select id from electoral.center_area_assignments where center_election_id=$1",[centers[1]])).rows[0].id;
});
afterAll(()=>db.close());
it("migra desde cero y puede repetir sin duplicar personas ni encargados",async()=>{
 const people=(await db.query("select id from electoral.people")).rows.length;
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});
 expect((await db.query("select id from electoral.people")).rows).toHaveLength(people);
 expect((await db.query("select id from electoral.center_area_assignments")).rows).toHaveLength(2);
});
it("cada centro configura su requisito y usa su propia asignación aunque comparta persona",async()=>{
 requirement=await configure();const second=await configure(centers[1]);
 expect(second).not.toBe(requirement);await progress();
 const a=await readCenterTraining(scope,centers[0]),b=await readCenterTraining(scope,centers[1]);
 expect(a.rows.find(x=>x.positionId===area)).toMatchObject({assignmentId:assignment,personName:expect.any(String),status:"cumplido",centerId:centers[0]});
 expect(b.rows.find(x=>x.positionId===area)).toMatchObject({assignmentId:otherAssignment,status:null});
 expect(a.rows).toHaveLength(8);expect(b.history.every(x=>x.status===null)).toBe(true);
});
it("SQL niega a A05 configurar o registrar capacitación",async()=>{
 await expect(configure(centers[0],requirement,"2020-01-02",member)).rejects.toThrow();
 await expect(progress(requirement,assignment,null,"convocado",member)).rejects.toThrow();
});
it("rechaza asignaciones de otro centro, requisitos cruzados y actualizaciones obsoletas",async()=>{
 await expect(progress(requirement,otherAssignment)).rejects.toThrow();
 await expect(progress(requirement,assignment,null,"cumplido",admin,centers[1])).rejects.toThrow();
 await expect(configure()).rejects.toThrow();await expect(progress()).rejects.toThrow();
});
it("una sustitución conserva el avance previo y no lo transmite al nuevo encargado",async()=>{
 const version=(await db.query<{version:string}>("select updated_at::text as version from electoral.people where id=$1",[person])).rows[0].version;
 await db.query("select electoral.save_center_responsible($1,$2,$3,$4,$5,'A05',$6,null,'','Responsable nuevo sintético','','','','Sustitución de prueba')",[admin,org,canton,event,centers[0],assignment]);
 const data=await readCenterTraining(scope,centers[0]);const row=data.rows.find(x=>x.positionId===area)!;
 expect(row.assignmentId).not.toBe(assignment);expect(row.status).toBeNull();expect(data.history.some(x=>x.status==="cumplido")).toBe(true);
 await expect(progress(requirement,assignment)).rejects.toThrow();expect(version).toBeTruthy();
});
it("otra revisión reinicia el avance y rechaza requisitos antiguos",async()=>{
 const next=await configure(centers[0],requirement,"2020-01-02");
 const row=(await readCenterTraining(scope,centers[0])).rows.find(x=>x.positionId===area)!;
 expect(row.requirementId).toBe(next);expect(row.status).toBeNull();await expect(progress(requirement,row.assignmentId!)).rejects.toThrow();
});
it("runtime no escribe tablas directamente y Data API no lee capacitación privada",async()=>{
 await db.exec("set role electoral_app");await expect(db.query("delete from electoral.center_training_progress")).rejects.toThrow();
 expect((await db.query("select id from electoral.center_training_progress")).rows.length).toBeGreaterThan(0);
 await db.exec("reset role;set role anon");await expect(db.query("select * from electoral.center_training_requirements")).rejects.toThrow();await db.exec("reset role");
});
