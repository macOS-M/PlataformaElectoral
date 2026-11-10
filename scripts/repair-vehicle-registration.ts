import { readFile } from "node:fs/promises";
import { administrativeDatabase } from "./database";
const stateQuery=`select to_regclass('electoral.vehicle_registrations') is not null as registration_table,to_regclass('electoral.vehicle_documents') is not null as documents_table,to_regprocedure('electoral.save_vehicle_with_documents(uuid,uuid,uuid,uuid,uuid,text,jsonb,text,jsonb)') is not null as unified_registration,to_regprocedure('electoral.unused_vehicle_registration_paths(uuid,uuid,uuid,uuid,jsonb)') is not null as cleanup_function`;
async function main(){
 const {client}=administrativeDatabase();
 try{
  const [before]=await client.unsafe(stateQuery);console.log(JSON.stringify(before));
  if(!process.argv.includes("--apply")){console.log("Solo diagnóstico. --apply completa las funciones de 0018 sin recrear tablas ni modificar registros.");return;}
  if(!before.registration_table||!before.documents_table)throw new Error("Faltan tablas previas; esta reparación solo completa funciones de un esquema parcial");
  const source=await readFile("src/server/db/migrations/0018_vehicle_registration_documents.sql","utf8");
  const statements=source.split("--> statement-breakpoint").map(s=>s.trim()).filter(s=>/^(CREATE (?:OR REPLACE )?FUNCTION electoral\.(?:add_vehicle_documents|save_vehicle_with_documents|unused_vehicle_registration_paths)\(|REVOKE ALL ON electoral\.vehicle_registrations|REVOKE ALL ON FUNCTION electoral\.save_vehicle_with_documents|GRANT EXECUTE ON FUNCTION electoral\.save_vehicle_with_documents)/.test(s)).map(s=>s.replace(/^CREATE FUNCTION /,"CREATE OR REPLACE FUNCTION "));
  if(statements.length!==6)throw new Error("Contenido inesperado en la reparación");
  await client.begin(async tx=>{for(const statement of statements)await tx.unsafe(statement);});
  const [after]=await client.unsafe(stateQuery);if(!after.unified_registration||!after.cleanup_function)throw new Error("No se confirmó la reparación");
  console.log(JSON.stringify(after));console.log("Funciones del registro conjunto habilitadas. No se recrearon tablas ni se modificaron vehículos o personas.");
 }finally{await client.end();}
}
main().catch(()=>{console.error("No se completó la reparación. Revisá conexión administrativa y esquema; no se imprimieron secretos.");process.exitCode=1;});
