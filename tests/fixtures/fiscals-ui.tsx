import { createRoot } from "react-dom/client";
import { FiscalWorkspace } from "../../src/modules/fiscals/workspace";
import type { Fiscal } from "../../src/modules/fiscals/repository";
declare global{interface Window{__fiscalSubmissions:Record<string,FormDataEntryValue>[];__fiscalReject:boolean;__fiscalAction:(previous:unknown,form:FormData)=>Promise<{error:string;success:string}>}}
window.__fiscalSubmissions=[];window.__fiscalReject=false;window.__fiscalAction=async(_previous,form)=>{window.__fiscalSubmissions.push(Object.fromEntries(form));return window.__fiscalReject?{error:"Rechazo de prueba. Conservamos los datos.",success:""}:{error:"",success:"Asignación guardada. Historial conservado."};};
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const people=[1,2,3,4].map(n=>({id:id(n),fullName:`Persona sintética ${n}`}));
const make=(n:number,role:Fiscal["role"],person:number,boardId:string|null):Fiscal=>({id:id(n),role,personId:id(person),personName:`Persona sintética ${person}`,boardId,accreditationScope:"Alcance declarado de prueba",accreditationReference:"Referencia sintética",startedAt:"2026-11-01T09:00:00-06:00",endedAt:null,endedReason:null});
const boards=[{id:id(11),number:101,sourceReference:"Listado sintético A"},{id:id(12),number:102,sourceReference:"Listado sintético B"}];
const params=new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-6 p-5"><h1 className="text-2xl font-semibold">Fiscales por centro y JRV</h1><p className="text-sm text-muted-foreground">Escuela sintética</p><FiscalWorkspace centerId={id(20)} boards={params.has("empty")?[]:boards} people={people} assignments={[make(31,"general",1,null),make(32,"general_suplente",2,null),...params.has("empty")?[]:[make(33,"titular",3,id(11))]]} canEdit={!params.has("reader")}/></main>);
