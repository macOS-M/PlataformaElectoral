import "server-only";
import { getConfiguration } from "@/server/config";
import { getAccessContext } from "@/server/authorization/context";
import { canEditModule } from "@/server/authorization/policy";
import { readTransport } from "@/modules/transport/repository";
import { formProtectionReady, hashTransportPayload, verifyTransportToken } from "./security";
import { availabilityQuerySchema,publicFilterSchema, publicRequestSchema, transportCommandSchema } from "./schemas";
import * as repository from "./repository";
import { readVehicle } from "@/modules/transport/document-repository";

export function getPublicTransportScope(){const c=getConfiguration();return c?{organizationId:c.APP_ORGANIZATION_ID,cantonId:c.APP_CANTON_ID,eventId:c.APP_EVENT_ID}:null;}
export function scopeKey(s:repository.TransportScope){return `${s.organizationId}/${s.cantonId}/${s.eventId}`;}
export async function getPublicTransport(query:Record<string,string|string[]|undefined>={}){
 const scope=getPublicTransportScope();
 const empty={ready:false,canSubmit:false,invalidFilters:false,districts:[] as {id:string;name:string}[],centers:[] as {id:string;name:string;districtId:string}[],services:[] as repository.PublicService[],district:"",center:""};
 if(!scope)return empty;
 try{
  const options=await repository.readPublicOptions(scope);
  const parsed=publicFilterSchema.safeParse(query);
  const district=parsed.success?parsed.data.district:undefined;const center=parsed.success?parsed.data.center:undefined;
  const selectedCenter=center?options.centers.find(c=>c.id===center):undefined;
  const valid=parsed.success&&(!district||options.districts.some(d=>d.id===district))&&(!center||!!selectedCenter)&&(!district||!selectedCenter||selectedCenter.districtId===district);
  // Even invalid filters verify availability; never return unfiltered results for them.
  const services=await repository.readPublicServices(scope,district,center);
  return {...options,ready:true,canSubmit:formProtectionReady(),invalidFilters:!valid,services:valid?services:[],district:valid?district??selectedCenter?.districtId??"":"",center:valid?center??"":""};
 }catch{return empty;}
}
export async function submitPublicTransport(input:unknown,formToken:string,session:string|undefined,trap:string){
 const scope=getPublicTransportScope();if(!scope||!formProtectionReady()||trap)throw new Error("Formulario no disponible");
 const data=publicRequestSchema.parse(input);
 const token=verifyTransportToken(formToken,session,scopeKey(scope),data.kind);
 const hash=hashTransportPayload(data);
 return repository.submitRequest(scope,data,token,hash);
}
export async function getTransportOperations(page=1,query:Record<string,string|string[]|undefined>={}){
 const scope=await getAccessContext();
 const empty={ready:false,canEdit:false,admin:false,vehicles:[],people:[],districts:[],centers:[],history:[],statuses:[],windows:[],trips:[],requests:[],availability:[] as repository.AvailabilityRow[],availabilityError:false,range:null as {startsAt:string;endsAt:string;districtId:string;centerId:string}|null};
 if(!scope)return empty;
 const base=await readTransport(scope);
 const requested=Boolean(query.from||query.to);
 const parsed=availabilityQuerySchema.safeParse({startsAt:typeof query.from==="string"?`${query.from}:00-06:00`:"",endsAt:typeof query.to==="string"?`${query.to}:00-06:00`:"",districtId:query.district,centerId:query.center??""});
 const valid=parsed.success&&base.districts.some(d=>d.id===parsed.data.districtId)&&(!parsed.data.centerId||base.centers.some(c=>c.id===parsed.data.centerId&&c.districtId===parsed.data.districtId));
 try{return {...base,...await repository.readOperations(scope,page),ready:true,canEdit:canEditModule(scope,"A05"),admin:scope.role==="admin",availability:valid?await repository.checkAvailability(scope,parsed.data):[],range:valid?parsed.data:null,availabilityError:requested&&!valid};}
 catch(error){const e=error as {code?:string;cause?:{code?:string}};if(["42P01","42883"].includes(e.cause?.code??e.code??""))return {...empty,...base};throw error;}
}
export async function updateTransportOperations(input:unknown){
 const scope=await getAccessContext();if(!scope||!canEditModule(scope,"A05"))throw new Error("Sin permiso");
 const data=transportCommandSchema.parse(input);
 if((data.operation==="review"||data.operation==="vehicleStatus"||(data.operation==="tripAction"&&data.action!=="cancel"))&&scope.role!=="admin")throw new Error("Solo administradores");
 if(data.operation==="review"&&data.status==="aprobada"&&data.vehicleId){
  const vehicle=await readVehicle(scope,data.vehicleId);
  if(!vehicle||(data.personId&&data.personId!==vehicle.responsibleId))throw new Error("El conductor debe coincidir con la ficha del vehículo");
  data.personId=vehicle.responsibleId;
 }
 return repository.runCommand(scope,data);
}
