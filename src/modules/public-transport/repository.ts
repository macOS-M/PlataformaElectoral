import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { AvailabilityQuery,PublicRequest, TransportCommand } from "./schemas";
export type TransportScope={organizationId:string;cantonId:string;eventId:string};
export type PublicService={id:string;title:string;meeting_point:string;institutional_contact:string;starts_at:string;ends_at:string;district_id:string;center_id:string|null};
export type RequestRow={id:string;kind:"driver"|"passenger";name:string;contact_channel:string;contact:string;district_id:string;center_id:string|null;desired_time:string;vehicle_details:string;status:string;version:number;linked_person_id:string|null;linked_vehicle_id:string|null;review_reason:string;created_at:string};
export type VehicleStatus={vehicleId:string;approved:boolean;status:string;version:number};
export type WindowRow={id:string;vehicleId:string;districtId:string;startsAt:string;endsAt:string;canceledAt:string|null;cancelReason:string};
export type TripRow=WindowRow&{centerId:string|null;title:string;meetingPoint:string;institutionalContact:string;published:boolean;confirmed:boolean;version:number;eligible:boolean};
export type AvailabilityRow={vehicle_id:string;available:boolean;vehicle_active:boolean;approved:boolean;operational_status:string;has_window:boolean;has_binding:boolean;conflict_count:number;conflicts:string};
export async function checkAvailability(s:AccessContext,q:AvailabilityQuery){return [...await getDb().execute<AvailabilityRow>(sql`select * from electoral.check_transport_availability(${s.userId}::uuid,${s.organizationId}::uuid,${s.cantonId}::uuid,${s.eventId}::uuid,${q.districtId}::uuid,${q.centerId||null}::uuid,${q.startsAt}::timestamptz,${q.endsAt}::timestamptz)`)];}
export async function readPublicOptions(s:TransportScope){
 const [scope]=await getDb().execute<{active:boolean}>(sql`select exists(select 1 from electoral.organizations o join electoral.organization_cantons c on c.organization_id=o.id join electoral.election_events e on e.organization_id=o.id where o.id=${s.organizationId}::uuid and o.active and c.canton_id=${s.cantonId}::uuid and c.active and e.id=${s.eventId}::uuid) as active`);
 if(!scope?.active)throw new Error("Ámbito público no disponible");
 const [districts,centers]=await Promise.all([
  getDb().execute<{id:string;name:string}>(sql`select d.id,d.name from electoral.districts d join electoral.organization_cantons oc on oc.canton_id=d.canton_id join electoral.organizations o on o.id=oc.organization_id where oc.organization_id=${s.organizationId}::uuid and oc.canton_id=${s.cantonId}::uuid and oc.active and o.active and d.active order by d.name,d.id`),
  getDb().execute<{id:string;name:string;districtId:string}>(sql`select ce.id,vc.name,ce.district_id as "districtId" from electoral.center_elections ce join electoral.voting_centers vc on vc.id=ce.center_id join electoral.districts d on d.id=ce.district_id where ce.organization_id=${s.organizationId}::uuid and ce.canton_id=${s.cantonId}::uuid and ce.event_id=${s.eventId}::uuid and ce.internal_status<>'inactivo' and vc.archived_at is null and d.active order by vc.name,ce.id`),
 ]);return {districts:[...districts],centers:[...centers]};
}
export async function readPublicServices(s:TransportScope,district?:string,center?:string){return [...await getDb().execute<PublicService>(sql`select * from electoral.public_transport_services(${s.organizationId}::uuid,${s.cantonId}::uuid,${s.eventId}::uuid,${district??null}::uuid,${center??null}::uuid)`)];}
export async function submitRequest(s:TransportScope,data:PublicRequest,token:{id:string;bucket:string},hash:string){return (await getDb().execute<{receipt:string}>(sql`select electoral.submit_transport_request(${s.organizationId}::uuid,${s.cantonId}::uuid,${s.eventId}::uuid,${token.id}::uuid,${token.bucket},${hash},${JSON.stringify(data)}::jsonb) as receipt`))[0].receipt;}
export async function readOperations(s:AccessContext,page:number){
 const [statuses,windows,trips,requests]=await Promise.all([
  getDb().execute<VehicleStatus>(sql`select vehicle_id as "vehicleId",approved,operational_status as status,version from electoral.transport_vehicle_status where organization_id=${s.organizationId}::uuid and canton_id=${s.cantonId}::uuid`),
  getDb().execute<WindowRow>(sql`select id,vehicle_id as "vehicleId",district_id as "districtId",starts_at::text as "startsAt",ends_at::text as "endsAt",canceled_at::text as "canceledAt",cancel_reason as "cancelReason" from electoral.transport_availability_windows where organization_id=${s.organizationId}::uuid and canton_id=${s.cantonId}::uuid and event_id=${s.eventId}::uuid order by created_at desc,id limit 200`),
  getDb().execute<TripRow>(sql`select id,vehicle_id as "vehicleId",district_id as "districtId",center_id as "centerId",starts_at::text as "startsAt",ends_at::text as "endsAt",title,meeting_point as "meetingPoint",institutional_contact as "institutionalContact",published,confirmed,version,canceled_at::text as "canceledAt",cancel_reason as "cancelReason",electoral.transport_trip_eligible(id) as eligible from electoral.transport_service_trips where organization_id=${s.organizationId}::uuid and canton_id=${s.cantonId}::uuid and event_id=${s.eventId}::uuid order by created_at desc,id limit 200`),
  s.role==="admin"?getDb().execute<RequestRow>(sql`select * from electoral.read_transport_requests(${s.userId}::uuid,${s.organizationId}::uuid,${s.cantonId}::uuid,${s.eventId}::uuid,${page})`):Promise.resolve([]),
 ]);return {statuses:[...statuses],windows:[...windows],trips:[...trips],requests:[...requests]};
}
export async function runCommand(s:AccessContext,d:TransportCommand){
 const a=sql`${s.userId}::uuid,${s.organizationId}::uuid,${s.cantonId}::uuid`;const scope=sql`${a},${s.eventId}::uuid`;
 switch(d.operation){
  case "review":return getDb().execute(sql`select electoral.review_transport_request(${scope},${d.id}::uuid,${d.version},${d.status},${d.personId||null}::uuid,${d.vehicleId||null}::uuid,${d.plate},${d.description},${d.reason})`);
  case "vehicleStatus":return getDb().execute(sql`select electoral.set_transport_vehicle_status(${a},${d.vehicleId}::uuid,${d.version},${d.approved},${d.operationalStatus})`);
  case "window":return getDb().execute(sql`select electoral.add_transport_window(${scope},${d.vehicleId}::uuid,${d.districtId}::uuid,${d.startsAt}::timestamptz,${d.endsAt}::timestamptz)`);
  case "trip":return getDb().execute(sql`select electoral.add_transport_trip(${scope},${d.vehicleId}::uuid,${d.districtId}::uuid,${d.centerId||null}::uuid,${d.startsAt}::timestamptz,${d.endsAt}::timestamptz,${d.title},${d.meetingPoint},${d.institutionalContact})`);
  case "tripAction":return getDb().execute(sql`select electoral.change_transport_trip(${scope},${d.id}::uuid,${d.version},${d.action},${d.reason})`);
  case "cancelWindow":return getDb().execute(sql`select electoral.cancel_transport_window(${scope},${d.id}::uuid,${d.reason})`);
 }
}
