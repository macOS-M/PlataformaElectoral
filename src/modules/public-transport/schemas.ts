import { z } from "zod";
import { MAX_TRANSPORT_REQUEST_TIME } from "./policy";
const optionalId=z.union([z.guid(),z.literal("")]);
const contactFields={contactChannel:z.enum(["","telefono","correo"]),contact:z.string().trim().max(254)};
export const publicRequestSchema=z.object({
  kind:z.enum(["driver","passenger"]),name:z.string().trim().max(160),...contactFields,
  districtId:optionalId,centerId:optionalId,desiredTime:z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),z.literal("")]),vehicleDetails:z.string().trim().max(160),
}).superRefine((d,ctx)=>{
  if(d.desiredTime && d.desiredTime > MAX_TRANSPORT_REQUEST_TIME)ctx.addIssue({code:"custom",path:["desiredTime"],message:"El horario solicitado debe ser a más tardar a las 5:00 p. m."});
  if(!d.districtId&&!d.centerId)ctx.addIssue({code:"custom",message:"Elegí distrito o centro"});
  if(d.kind==="driver"&&(d.name.length<2||!d.contact||!d.districtId))ctx.addIssue({code:"custom",message:"Nombre, contacto y zona requeridos"});
  if(d.kind==="driver"&&d.vehicleDetails.length<2)ctx.addIssue({code:"custom",path:["vehicleDetails"],message:"Indicá el vehículo con el que te inscribís."});
  if(d.contactChannel==="correo"&&!z.email().safeParse(d.contact).success)ctx.addIssue({code:"custom",message:"Correo inválido"});
  if(d.contactChannel==="telefono"&&(!/^[+()\d .-]{6,40}$/.test(d.contact)||d.contact.replace(/\D/g,"").length<6||d.contact.replace(/\D/g,"").length>20))ctx.addIssue({code:"custom",message:"Teléfono inválido"});
  if((!d.contact&&d.contactChannel)||(!d.contactChannel&&d.contact))ctx.addIssue({code:"custom",message:"Revisá el medio de respuesta"});
  if(d.kind==="passenger"&&(d.name||d.vehicleDetails))ctx.addIssue({code:"custom",message:"Datos no requeridos"});
});
const interval={startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true})};
const version=z.coerce.number().int().min(0);
const reason=z.string().trim().min(3).max(500);
const operations=[
  z.object({operation:z.literal("review"),id:z.guid(),version,status:z.enum(["aprobada","rechazada","atendida"]),personId:optionalId,vehicleId:optionalId,plate:z.union([z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/),z.literal("")]),description:z.string().trim().max(160),reason,confirmed:z.boolean()}),
  z.object({operation:z.literal("vehicleStatus"),vehicleId:z.guid(),version,approved:z.boolean(),operationalStatus:z.enum(["sin_verificar","operativo","mantenimiento","fuera_servicio"])}),
  z.object({operation:z.literal("window"),vehicleId:z.guid(),districtId:z.guid(),...interval}),
  z.object({operation:z.literal("trip"),vehicleId:z.guid(),districtId:z.guid(),centerId:optionalId,...interval,title:z.string().trim().min(2).max(160),meetingPoint:z.string().trim().min(2).max(300),institutionalContact:z.string().trim().max(254)}),
  z.object({operation:z.literal("tripAction"),id:z.guid(),version,action:z.enum(["publish","unpublish","cancel"]),reason:z.string().trim().max(500),authorized:z.boolean()}),
  z.object({operation:z.literal("cancelWindow"),id:z.guid(),reason}),
] as const;
export const transportCommandSchema=z.discriminatedUnion("operation",operations).superRefine((d,ctx)=>{
  if((d.operation==="window"||d.operation==="trip")&&new Date(d.endsAt)<=new Date(d.startsAt))ctx.addIssue({code:"custom",message:"El final debe ser posterior"});
  if(d.operation==="tripAction"&&((d.action==="publish"&&!d.authorized)||(d.action==="cancel"&&d.reason.length<3)))ctx.addIssue({code:"custom",message:"Confirmá publicación o motivo"});
  if(d.operation==="review"&&d.vehicleId&&d.plate)ctx.addIssue({code:"custom",message:"Reutilizá o creá un vehículo, no ambos"});
  if(d.operation==="review"&&d.status==="aprobada"&&!d.confirmed)ctx.addIssue({code:"custom",message:"Confirmá la revisión de identidad"});
  if(d.operation==="review"&&d.status==="aprobada"&&!d.vehicleId&&!d.plate)ctx.addIssue({code:"custom",message:"Vinculá un vehículo existente o registrá uno para aprobar al conductor."});
  if(d.operation==="review"&&d.status==="aprobada"&&d.plate&&d.description.length<2)ctx.addIssue({code:"custom",message:"Completá la descripción del vehículo."});
});
const optionalQueryId=z.preprocess(value=>value===""?undefined:value,z.guid().optional());
export const publicFilterSchema=z.object({district:optionalQueryId,center:optionalQueryId});
export type PublicRequest=z.infer<typeof publicRequestSchema>;
export type TransportCommand=z.infer<typeof transportCommandSchema>;
export const availabilityQuerySchema=z.object({districtId:z.guid(),centerId:optionalId,...interval}).refine(d=>new Date(d.endsAt)>new Date(d.startsAt));
export type AvailabilityQuery=z.infer<typeof availabilityQuerySchema>;
