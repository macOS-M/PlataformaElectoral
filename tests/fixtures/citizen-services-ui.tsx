import { createRoot } from "react-dom/client";
import { CitizenServicesView } from "../../src/modules/public-portal/services-view";
import { TerritorySelector } from "../../src/modules/public-portal/territory-selector";
import { PublicTransportForm } from "../../src/modules/public-transport/public-ui";
declare global{interface Window{__citizenRequest:(form:FormData)=>Promise<{error:string;receipt:string}>}}
window.__citizenRequest=async()=>({error:"",receipt:crypto.randomUUID()});
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const territory={id:id(2),name:"Cantón de prueba",province:{id:id(1),name:"Provincia de prueba"},districts:[{id:id(3),name:"Distrito de prueba"}]};
const districts=[{id:id(3),name:"Distrito de prueba"}],centers=[{id:id(4),name:"Escuela Central de prueba",districtId:id(3)},{id:id(8),name:"Escuela Norte de prueba",districtId:id(3)}];
const params=new URLSearchParams(location.search);const selectedCenter=params.get("center")??"";
const selection={canton:territory,district:territory.districts[0]};
const services=[{id:id(5),title:"Ruta al centro de votación",meeting_point:"Parque central · Costado del quiosco",institutional_contact:"central@example.test",starts_at:"2099-11-08T08:00:00-06:00",ends_at:"2099-11-08T10:00:00-06:00",district_id:id(3),center_id:id(4)},{id:id(6),title:"Recorrido distrital de la mañana",meeting_point:"Salón comunal de prueba",institutional_contact:"Oficina de coordinación · contacto institucional",starts_at:"2099-11-08T07:00:00-06:00",ends_at:"2099-11-08T11:00:00-06:00",district_id:id(3),center_id:null}];
const data={ready:!params.has("unavailable"),canSubmit:true,invalidFilters:false,districts,centers,services:params.has("empty")?[]:services.filter(s=>!selectedCenter||!s.center_id||s.center_id===selectedCenter),district:id(3),center:selectedCenter};
const root=createRoot(document.getElementById("root")!);
if(location.pathname.includes("/solicitar"))root.render(<main className="mx-auto max-w-3xl p-5"><h1 className="mb-6 text-2xl font-semibold">Solicitá información de transporte</h1><PublicTransportForm kind="passenger" districts={districts} centers={centers} initialDistrict={id(3)} initialCenter={selectedCenter} cantonId={id(2)}/></main>);
else if(params.get("district")===id(3)&&params.get("canton")===id(2))root.render(<CitizenServicesView selection={selection} transport={data}/>);
else root.render(<main className="mx-auto max-w-3xl space-y-6 p-5"><h1 className="text-2xl font-semibold">Seleccioná tu zona</h1><TerritorySelector territories={[territory]} action="/servicios"/></main>);
