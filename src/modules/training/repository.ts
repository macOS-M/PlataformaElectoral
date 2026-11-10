import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { ProgressInput, RequirementInput } from "./schemas";

export type TrainingRow = { centerId?: string; positionId: string; name: string; requirementId: string | null; required: boolean | null; scheduledOn: string | null; revision: number | null; assignmentId: string | null; personName: string | null; progressId: string | null; status: string | null; statusOn: string | null };
export type TrainingHistory = { positionName: string; personName: string | null; required: boolean; scheduledOn: string | null; revision: number; status: string | null; statusOn: string | null };
export async function readTraining(scope: AccessContext) {
  const db = getDb();
  const [rows, history] = await Promise.all([
    db.execute<TrainingRow>(sql`select p.id as "positionId",p.name,r.id as "requirementId",r.required,r.scheduled_on::text as "scheduledOn",r.revision,a.id as "assignmentId",person.full_name as "personName",s.id as "progressId",s.status,s.status_on::text as "statusOn"
      from electoral.organizational_positions p
      left join lateral (select * from electoral.training_requirements where position_id=p.id and event_id=${scope.eventId}::uuid order by revision desc limit 1) r on true
      left join electoral.organizational_assignments a on a.position_id=p.id and a.ended_at is null
      left join electoral.people person on person.id=a.person_id
      left join lateral (select * from electoral.training_progress where requirement_id=r.id and assignment_id=a.id order by sequence desc limit 1) s on true
      where p.organization_id=${scope.organizationId}::uuid and p.canton_id=${scope.cantonId}::uuid and p.active
      and not exists(select 1 from electoral.functional_areas fa where fa.id=p.functional_area_id and fa.organization_id=p.organization_id and fa.code='A09') order by p.code,p.id`),
    db.execute<TrainingHistory>(sql`select p.name as "positionName",person.full_name as "personName",r.required,r.scheduled_on::text as "scheduledOn",r.revision,s.status,s.status_on::text as "statusOn"
      from electoral.training_requirements r join electoral.organizational_positions p on p.id=r.position_id
      left join electoral.training_progress s on s.requirement_id=r.id
      left join electoral.organizational_assignments a on a.id=s.assignment_id left join electoral.people person on person.id=a.person_id
      where r.organization_id=${scope.organizationId}::uuid and r.canton_id=${scope.cantonId}::uuid and r.event_id=${scope.eventId}::uuid
      and not exists(select 1 from electoral.functional_areas fa where fa.id=p.functional_area_id and fa.organization_id=p.organization_id and fa.code='A09') order by r.created_at desc,r.revision desc,s.sequence desc`),
  ]);
  return { rows: [...rows], history: [...history] };
}
export async function saveRequirement(scope: AccessContext, data: RequirementInput) {
  if(data.centerId)return getDb().execute(sql`select electoral.save_center_training_requirement(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.centerId}::uuid,${data.positionId}::uuid,${data.expectedId||null}::uuid,${data.required},${data.scheduledOn||null}::date)`);
  return getDb().execute(sql`select electoral.save_training_requirement(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.positionId}::uuid,${data.expectedId || null}::uuid,${data.required},${data.scheduledOn || null}::date)`);
}
export async function recordProgress(scope: AccessContext, data: ProgressInput) {
  if(data.centerId)return getDb().execute(sql`select electoral.record_center_training_progress(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.centerId}::uuid,${data.requirementId}::uuid,${data.assignmentId}::uuid,${data.expectedId||null}::uuid,${data.status},${data.statusOn}::date)`);
  return getDb().execute(sql`select electoral.record_training_progress(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.requirementId}::uuid,${data.assignmentId}::uuid,${data.expectedId || null}::uuid,${data.status},${data.statusOn}::date)`);
}
