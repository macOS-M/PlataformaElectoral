"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { submitPublicTransport, updateTransportOperations } from "./service";
import { transportCookie } from "./security";
export type PublicTransportState={error:string;receipt:string};
export async function submitTransportAction(_state:PublicTransportState,form:FormData):Promise<PublicTransportState>{
 try{
  const fields=Object.fromEntries(["kind","name","contactChannel","contact","districtId","centerId","desiredTime","vehicleDetails"].map(key=>[key,form.get(key)??""]));
  const receipt=await submitPublicTransport(fields,String(form.get("formToken")??""),(await cookies()).get(transportCookie)?.value,String(form.get("website")??""));
  return {error:"",receipt};
 }catch(error){const e=error as {code?:string;cause?:{code?:string}};return {receipt:"",error:(e.cause?.code??e.code)==="54000"?"Llegaste al límite de envíos. Intentá más tarde.":"No pudimos registrar la solicitud. Revisá los datos; si el formulario venció, renovalo y reintentá. No se confirmó ningún cupo."};}
}
export type TransportOperationState={error:string;success:string};
export async function transportOperationAction(_state:TransportOperationState,form:FormData):Promise<TransportOperationState>{
 try{await updateTransportOperations({...Object.fromEntries(form),approved:form.get("approved")==="on",authorized:form.get("authorized")==="on",confirmed:form.get("confirmed")==="on",...(form.has("startsLocal")?{startsAt:`${String(form.get("startsLocal"))}:00-06:00`,endsAt:`${String(form.get("endsLocal"))}:00-06:00`}:{})});}
 catch(error){const e=error as {code?:string;cause?:{code?:string}};const code=e.cause?.code??e.code;return {success:"",error:code==="40001"?"Los datos cambiaron. Recargá antes de guardar.":code==="23P01"?"Conflicto: ese vehículo ya tiene un servicio en el intervalo elegido.":code==="23505"?"El vehículo ya está registrado. Reutilizá su ficha.":"No se pudo guardar. Revisá permisos, vínculo territorial, aprobación, estado operativo y horarios."};}
 revalidatePath("/transporte");revalidatePath("/transporte/operacion");revalidatePath("/servicios/transporte");
 return {error:"",success:"Operación registrada. Se conservó el historial."};
}
