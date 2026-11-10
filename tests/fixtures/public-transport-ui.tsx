// Synthetic UI fixture; actions and tokens are replaced only by the browser test.
import { createRoot } from "react-dom/client";
import { PublicTransportForm } from "../../src/modules/public-transport/public-ui";
import { TransportOperationsWorkspace } from "../../src/modules/public-transport/operations-ui";
import { PageHeading } from "../../src/components/page-heading";
import type { getTransportOperations } from "../../src/modules/public-transport/service";
declare global{interface Window{__transportUiSubmissions:Record<string,string>[];__transportUiReject:boolean;__transportUiSave:(kind:string,form:FormData)=>Promise<{error:string;success:string;receipt:string}>}}
window.__transportUiSubmissions=[];window.__transportUiReject=false;
window.__transportUiSave=async(kind,form)=>{window.__transportUiSubmissions.push(Object.fromEntries([...form.entries()].map(([k,v])=>[k,String(v)])));if(window.__transportUiReject){window.__transportUiReject=false;return {error:"No pudimos registrar la solicitud. Conservamos los datos para reintentar.",success:"",receipt:""};}return {error:"",success:"Operación registrada.",receipt:kind==="public"?crypto.randomUUID():""};};
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const districts=[{id:id(1),name:"Distrito de prueba"}];const centers=[{id:id(2),name:"Escuela de prueba",districtId:id(1)}];
const query=new URLSearchParams(location.search);const mode=query.get("mode")??"passenger";
const admin=!query.has("operator")&&!query.has("reader");
const data:Awaited<ReturnType<typeof getTransportOperations>>={
 ready:true,canEdit:!query.has("reader"),admin,availabilityError:false,range:null,
 vehicles:[{id:id(3),plate:"TEST-01",description:"Vehículo de prueba",responsibleId:id(4),active:true,version:1,districtIds:[id(1)],centerIds:[id(2)]}],
 people:[{id:id(4),fullName:"Responsable sintético",phone:null,email:"privado@example.test",version:"1"}],districts,centers,history:[],
 statuses:[{vehicleId:id(3),approved:true,status:"operativo",version:1}],
 windows:[{id:id(5),vehicleId:id(3),districtId:id(1),startsAt:"2099-11-08T08:00:00-06:00",endsAt:"2099-11-08T18:00:00-06:00",canceledAt:null,cancelReason:""}],
 trips:[{id:id(6),vehicleId:id(3),districtId:id(1),centerId:id(2),title:"Servicio de prueba",meetingPoint:"Punto institucional de prueba",institutionalContact:"central@example.test",startsAt:"2099-11-08T09:00:00-06:00",endsAt:"2099-11-08T10:00:00-06:00",published:false,confirmed:false,eligible:true,version:1,canceledAt:null,cancelReason:""}],
 availability:[{vehicle_id:id(3),available:false,vehicle_active:true,approved:true,operational_status:"operativo",has_window:true,has_binding:true,conflict_count:1,conflicts:"Servicio de prueba · 2099-11-08 09:00 → 10:00"}],
 requests:admin?[{id:id(7),kind:"driver",name:"Transportista sintético",contact_channel:"correo",contact:"transportista@example.test",district_id:id(1),center_id:null,desired_time:"",vehicle_details:"",status:"pendiente",version:1,linked_person_id:null,linked_vehicle_id:null,review_reason:"",created_at:"2020-01-01T00:00:00Z"},{id:id(8),kind:"passenger",name:"",contact_channel:"",contact:"",district_id:id(1),center_id:id(2),desired_time:"",vehicle_details:"",status:"pendiente",version:1,linked_person_id:null,linked_vehicle_id:null,review_reason:"",created_at:"2020-01-01T00:00:00Z"}]:[],
};
createRoot(document.getElementById("root")!).render(<><PageHeading eyebrow={mode==="ops"?"Transporte · Operación":"Servicios ciudadanos"} title={mode==="ops"?"Disponibilidad y solicitudes":mode==="driver"?"Apoyá como transportista":"Solicitá información de transporte"} description="Entorno aislado con datos de prueba."/>{mode==="ops"?<TransportOperationsWorkspace data={data} page={1}/>:<div className="rounded-2xl border bg-card p-5"><PublicTransportForm kind={mode==="driver"?"driver":"passenger"} districts={districts} centers={centers}/></div>}</>);
