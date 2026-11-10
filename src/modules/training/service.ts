import "server-only";
import { getAccessContext } from "@/server/authorization/context";
import { isGlobalAdmin } from "@/server/authorization/policy";
import { progressSchema, requirementSchema } from "./schemas";
import * as repository from "./repository";
import { getCenterDetail } from "@/modules/voting-centers/area-service";
import { readCenterTraining } from "./center-repository";
export async function getCenterTraining(centerId:string){
 const {scope,center}=await getCenterDetail(centerId);
 try{return {canEdit:isGlobalAdmin(scope),configured:true,unavailable:false,center,...await readCenterTraining(scope,centerId)};}
 catch(error){const e=error as {code?:string;cause?:{code?:string}};if((e.cause?.code??e.code)==="42P01")return {canEdit:false,configured:true,unavailable:true,center,rows:[],history:[]};throw error;}
}
export async function getTraining() {
  const scope = await getAccessContext();
  return { canEdit: isGlobalAdmin(scope), configured: !!scope, ...(scope ? await repository.readTraining(scope) : { rows: [], history: [] }) };
}
async function requireTrainingAdmin() {
  const scope = await getAccessContext();
  if (!scope || !isGlobalAdmin(scope)) throw new Error("Solo administradores gestionan capacitación");
  return scope;
}
export async function updateRequirement(input: unknown) {
  const scope = await requireTrainingAdmin();
  return repository.saveRequirement(scope, requirementSchema.parse(input));
}
export async function updateProgress(input: unknown) {
  const scope = await requireTrainingAdmin();
  return repository.recordProgress(scope, progressSchema.parse(input));
}
