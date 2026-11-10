import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { VehicleInput } from "./schemas";

export type TransportPerson = { id: string; fullName: string; phone: string | null; email: string | null; version: string };
export type VehicleRow = { id: string; plate: string; description: string; responsibleId: string; active: boolean; version: number; districtIds: string[]; centerIds: string[] };
export type TransportHistory = { centerId?:string|null; plate: string; kind: string; destination: string; startedAt: string; endedAt: string | null };
export async function readTransport(scope: AccessContext) {
  const db = getDb();
  const [vehicles, people, districts, centers, history] = await Promise.all([
    db.execute<VehicleRow>(sql`select v.id,v.plate,v.description,v.responsible_id as "responsibleId",v.active,v.version,
      array(select district_id from electoral.vehicle_district_assignments where vehicle_id=v.id and event_id=${scope.eventId}::uuid and ended_at is null) as "districtIds",
      array(select center_election_id from electoral.vehicle_center_assignments where vehicle_id=v.id and event_id=${scope.eventId}::uuid and ended_at is null) as "centerIds"
      from electoral.vehicles v where organization_id=${scope.organizationId}::uuid and canton_id=${scope.cantonId}::uuid order by plate`),
    db.execute<TransportPerson>(sql`select id,full_name as "fullName",phone,email,updated_at::text as version from electoral.people where organization_id=${scope.organizationId}::uuid order by full_name,id`),
    db.execute<{ id: string; name: string }>(sql`select id,name from electoral.districts where canton_id=${scope.cantonId}::uuid and active order by name,id`),
    db.execute<{ id: string; name: string; districtId: string }>(sql`select ce.id,c.name,ce.district_id as "districtId" from electoral.center_elections ce join electoral.voting_centers c on c.id=ce.center_id where ce.organization_id=${scope.organizationId}::uuid and ce.canton_id=${scope.cantonId}::uuid and ce.event_id=${scope.eventId}::uuid and c.archived_at is null and ce.internal_status<>'inactivo' order by c.name,ce.id`),
    db.execute<TransportHistory>(sql`select a.center_election_id as "centerId",v.plate,'Centro' as kind,c.name as destination,a.started_at::text as "startedAt",a.ended_at::text as "endedAt" from electoral.vehicle_center_assignments a join electoral.vehicles v on v.id=a.vehicle_id join electoral.center_elections ce on ce.id=a.center_election_id join electoral.voting_centers c on c.id=ce.center_id where a.organization_id=${scope.organizationId}::uuid and a.canton_id=${scope.cantonId}::uuid and a.event_id=${scope.eventId}::uuid
      union all select null::uuid,v.plate,'Distrito',d.name,a.started_at::text,a.ended_at::text from electoral.vehicle_district_assignments a join electoral.vehicles v on v.id=a.vehicle_id join electoral.districts d on d.id=a.district_id where a.organization_id=${scope.organizationId}::uuid and a.canton_id=${scope.cantonId}::uuid and a.event_id=${scope.eventId}::uuid order by "startedAt" desc`),
  ]);
  return { vehicles: [...vehicles], people: [...people], districts: [...districts], centers: [...centers], history: [...history] };
}
export async function saveVehicle(scope: AccessContext, data: VehicleInput) {
  // Array literal construido únicamente con UUIDs ya validados; enviado como parámetro SQL.
  const rows=await getDb().execute<{id:string}>(sql`select electoral.save_vehicle(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.id || null}::uuid,${data.version},${data.plate},${data.description},${data.personId || null}::uuid,${data.personVersion},${data.fullName},${data.phone},${data.email},${data.active},${`{${data.districtIds.join(",")}}`}::uuid[],${`{${data.centerIds.join(",")}}`}::uuid[],${data.reason}) as id`);return rows[0].id;
}
