import { beforeAll,afterAll,it,expect,vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import type { SQL } from "drizzle-orm";
import type { AccessContext } from "@/server/authorization/context";
vi.mock("server-only",()=>({}));
vi.mock("@/server/db/client",()=>({getDb:()=>({execute:async(q:SQL)=>(await drizzle(db).execute(q)).rows})}));
import { readFiscals } from "@/modules/fiscals/repository";
const db=new PGlite();
const org="10000000-0000-4000-8000-000000000001",canton="20000000-0000-4000-8000-000000000001",event="30000000-0000-4000-8000-000000000001",admin="80000000-0000-4000-8000-000000000001",electoral="80000000-0000-4000-8000-000000000002",transport="80000000-0000-4000-8000-000000000003",reader="80000000-0000-4000-8000-000000000004";
const scope:AccessContext={userId:admin,organizationId:org,cantonId:canton,eventId:event,role:"admin",editableModules:[],organizationName:"Organización sintética",cantonName:"Cantón de prueba",eventName:"Evento sintético",isDemo:true};
let centers:string[],people:string[],board:string,otherBoard:string,general:string,titular:string,suplente:string;
async function createBoard(number:number,center=centers[0],actor=electoral,eventId=event){return (await db.query<{id:string}>("select electoral.create_election_board($1,$2,$3,$4,$5,$6,'Listado sintético de prueba') as id",[actor,org,canton,eventId,center,number])).rows[0].id;}
async function assign(role:string,person:string|null,options:{center?:string;board?:string|null;expected?:string|null;actor?:string;reason?:string;scope?:string;event?:string}={}){return (await db.query<{id:string}>("select electoral.set_center_fiscal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Referencia sintética',$11) as id",[options.actor??electoral,org,canton,options.event??event,options.center??centers[0],options.board??null,role,options.expected??null,person,options.scope??"Alcance declarado en documento de prueba",options.reason??""])).rows[0].id;}
beforeAll(async()=>{
 await db.exec("create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz);create role anon;create role authenticated;");
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});await db.exec(await readFile("src/server/db/seeds/demo.sql","utf8"));
 await db.query("insert into auth.users(id) values($1),($2),($3),($4)",[admin,electoral,transport,reader]);
 for(const actor of [admin,electoral,transport,reader])await db.query("insert into electoral.organization_memberships(organization_id,user_id,role) values($1,$2,$3)",[org,actor,actor===admin?"admin":"member"]);
 await db.query("insert into electoral.module_permissions(organization_id,user_id,canton_id,module) values($1,$2,$3,'A04'),($1,$4,$3,'A05')",[org,electoral,canton,transport]);
 centers=(await db.query<{id:string}>("select id from electoral.center_elections order by id limit 2")).rows.map(x=>x.id);
 people=(await db.query<{id:string}>("select person_id as id from electoral.user_people order by user_id")).rows.map(x=>x.id);
});
afterAll(()=>db.close());
it("la migración no fabrica JRV ni fiscales a partir de cantidades reportadas",async()=>{
 expect((await db.query("select id from electoral.election_boards")).rows).toHaveLength(0);expect((await db.query("select id from electoral.fiscal_assignments")).rows).toHaveLength(0);
 await migrate(drizzle(db),{migrationsFolder:"src/server/db/migrations"});
});
it("registra JRV explícitas y rechaza número repetido en otro centro del mismo evento",async()=>{
 board=await createBoard(1234);otherBoard=await createBoard(1235,centers[1]);
 await expect(createBoard(1234,centers[1])).rejects.toThrow();await expect(createBoard(0)).rejects.toThrow();
 const data=await readFiscals(scope,centers[0]);expect(data.boards).toMatchObject([{id:board,number:1234}]);expect(data.assignments).toHaveLength(0);
});
it("permite fiscal general y varios suplentes reutilizando personas",async()=>{
 const before=(await db.query("select id from electoral.people")).rows.length;
 general=await assign("general",people[0]);await assign("general_suplente",people[1]);await assign("general_suplente",people[2]);
 expect((await db.query("select id from electoral.people")).rows).toHaveLength(before);
 expect((await readFiscals(scope,centers[0])).assignments.filter(a=>!a.endedAt&&a.role.startsWith("general"))).toHaveLength(3);
 await expect(assign("general",people[3])).rejects.toThrow();await expect(assign("general_suplente",people[0])).rejects.toThrow();
});
it("JRV admite titular y suplente distintos y no permite ocupar dos veces el mismo puesto",async()=>{
 titular=await assign("titular",people[0],{board});suplente=await assign("suplente",people[1],{board});
 await expect(assign("suplente",people[0],{board,expected:suplente,reason:"Cambio de prueba"})).rejects.toThrow();
 await expect(assign("titular",people[2],{board})).rejects.toThrow();
 const data=await readFiscals(scope,centers[0]);expect(data.assignments.filter(a=>a.boardId===board&&!a.endedAt)).toHaveLength(2);
});
it("no cruza centro, evento, persona ni clase de fiscal",async()=>{
 await expect(assign("titular",people[2],{board:otherBoard})).rejects.toThrow();
 await expect(assign("titular",people[2],{board,center:centers[1]})).rejects.toThrow();
 await expect(assign("general",people[0],{board})).rejects.toThrow();await expect(assign("titular",people[0])).rejects.toThrow();
 await expect(assign("general_suplente","ffffffff-ffff-4fff-8fff-ffffffffffff")).rejects.toThrow();
 await expect(createBoard(1236,centers[0],electoral,"ffffffff-ffff-4fff-8fff-ffffffffffff")).rejects.toThrow();
});
it.each([transport,reader])("SQL rechaza escrituras sin A04/distrital/admin: %s",async actor=>{
 await expect(createBoard(2222,centers[0],actor)).rejects.toThrow();await expect(assign("general_suplente",people[3],{actor})).rejects.toThrow();
});
it("sustituye y retira con motivo conservando acreditación e historial",async()=>{
 await expect(assign("general",people[3],{expected:general})).rejects.toThrow();
 const replacement=await assign("general",people[3],{expected:general,reason:"Sustitución documentada"});
 let data=await readFiscals(scope,centers[0]);expect(data.assignments.find(a=>a.id===general)).toMatchObject({endedReason:"Sustitución documentada",accreditationReference:"Referencia sintética"});
 await expect(assign("general",people[0],{expected:general,reason:"Versión antigua"})).rejects.toThrow();
 await assign("general",null,{expected:replacement,reason:"Retiro documentado"});data=await readFiscals(scope,centers[0]);expect(data.assignments.filter(a=>a.role==="general"&&!a.endedAt)).toHaveLength(0);
});
it("si falla el sustituto, revierte el cierre previo y la auditoría",async()=>{
 const before=(await db.query("select id from electoral.audit_logs")).rows.length;
 await expect(assign("titular",people[1],{board,expected:titular,reason:"Conflicto intencional"})).rejects.toThrow();
 expect((await db.query<{ended_at:string|null}>("select ended_at from electoral.fiscal_assignments where id=$1",[titular])).rows[0].ended_at).toBeNull();expect((await db.query("select id from electoral.audit_logs")).rows).toHaveLength(before);
});
it("cada centro lee exclusivamente sus JRV y asignaciones",async()=>{
 await assign("titular",people[3],{center:centers[1],board:otherBoard});const data=await readFiscals(scope,centers[0]);expect(data.boards.some(b=>b.id===otherBoard)).toBe(false);expect(data.assignments.some(a=>a.boardId===otherBoard)).toBe(false);
});
it("runtime solo escribe por funciones y Data API no lee ni ejecuta",async()=>{
 await db.exec("set role electoral_app");expect((await db.query("select id from electoral.election_boards")).rows.length).toBe(2);await expect(db.query("delete from electoral.fiscal_assignments")).rejects.toThrow();
 await createBoard(1236);await db.exec("reset role;set role anon");await expect(db.query("select * from electoral.fiscal_assignments")).rejects.toThrow();await expect(createBoard(1237)).rejects.toThrow();await db.exec("reset role");
});
