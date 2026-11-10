import { z } from "zod";
const optionalId=z.union([z.guid(),z.literal("")]);
export const fiscalRoles=["general","general_suplente","titular","suplente"] as const;
export type FiscalRole=typeof fiscalRoles[number];
export const fiscalRoleLabels:Record<FiscalRole,string>={general:"Fiscal general",general_suplente:"Fiscal general suplente",titular:"Fiscal de mesa titular (propietario)",suplente:"Fiscal de mesa suplente"};
export const boardSchema=z.object({centerId:z.guid(),number:z.coerce.number().int().min(1).max(2147483647),sourceReference:z.string().trim().min(3).max(500)});
export const fiscalSchema=z.object({
 centerId:z.guid(),boardId:optionalId,role:z.enum(fiscalRoles),expectedId:optionalId,personId:optionalId,
 accreditationScope:z.string().trim().max(1000),accreditationReference:z.string().trim().max(500),reason:z.string().trim().max(500),
}).superRefine((d,ctx)=>{
 const general=d.role==="general"||d.role==="general_suplente";
 if(general===!!d.boardId)ctx.addIssue({code:"custom",path:["boardId"],message:"La JRV corresponde únicamente a fiscales de mesa."});
 if(!d.expectedId&&!d.personId)ctx.addIssue({code:"custom",message:"Seleccioná una persona existente."});
 if(d.expectedId&&d.reason.length<3)ctx.addIssue({code:"custom",path:["reason"],message:"Indicá el motivo de sustitución, cambio o retiro."});
});
export type BoardInput=z.infer<typeof boardSchema>;
export type FiscalInput=z.infer<typeof fiscalSchema>;
