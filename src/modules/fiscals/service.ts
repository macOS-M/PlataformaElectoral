import "server-only";
import { getAccessContext } from "@/server/authorization/context";
import { canEditModule } from "@/server/authorization/policy";
import { getCenterDetail } from "@/modules/voting-centers/area-service";
import { boardSchema,fiscalSchema } from "./schemas";
import * as repository from "./repository";
import { z } from "zod";
import { personSchema } from "@/modules/organization/schemas";
import { savePerson } from "@/modules/organization/repository";
export async function getFiscals(centerId:string){
 const {scope,center}=await getCenterDetail(centerId);
 try{return {center,canEdit:canEditModule(scope,"A04")&&center.status!=="inactivo",ready:true,...await repository.readFiscals(scope,centerId)};}
 catch(error){const e=error as {code?:string;cause?:{code?:string}};if((e.cause?.code??e.code)==="42P01")return {center,canEdit:false,ready:false,boards:[],assignments:[],people:[]};throw error;}
}
async function requireFiscalEditor(){const scope=await getAccessContext();if(!scope||!canEditModule(scope,"A04"))throw new Error("Sin permiso electoral");return scope;}
export async function addBoard(input:unknown){const scope=await requireFiscalEditor();return repository.createBoard(scope,boardSchema.parse(input));}
export async function assignFiscal(input:unknown){const scope=await requireFiscalEditor();return repository.setFiscal(scope,fiscalSchema.parse(input));}
export async function addFiscalPerson(input:unknown){
 const scope=await requireFiscalEditor();const fields=z.object({centerId:z.guid(),fullName:z.string(),phone:z.string(),email:z.string()}).parse(input);
 const {center}=await getCenterDetail(fields.centerId);if(center.status==="inactivo")throw new Error("Centro inactivo");
 return savePerson(scope,personSchema.parse({...fields,id:"",version:"",notes:""}));
}
