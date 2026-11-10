import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { TrainingRow,TrainingHistory } from "./repository";
export async function readCenterTraining(scope:AccessContext,centerId:string){
 const db=getDb();
 const [rows,history]=await Promise.all([
  db.execute<TrainingRow>(sql`select ${centerId}::text as "centerId",f.id as "positionId",f.name,r.id as "requirementId",r.required,r.scheduled_on::text as "scheduledOn",r.revision,a.id as "assignmentId",p.full_name as "personName",s.id as "progressId",s.status,s.status_on::text as "statusOn"
  from electoral.center_elections ce join electoral.functional_areas f on f.organization_id=ce.organization_id and f.active and f.code<>'A09'
  left join lateral(select * from electoral.center_training_requirements where center_id=ce.id and area_id=f.id order by revision desc limit 1) r on true
  left join electoral.center_area_assignments a on a.center_election_id=ce.id and a.area_id=f.id and a.ended_at is null
  left join electoral.people p on p.id=a.person_id
  left join lateral(select * from electoral.center_training_progress where requirement_id=r.id and assignment_id=a.id order by sequence desc limit 1) s on true
  where ce.id=${centerId}::uuid and ce.organization_id=${scope.organizationId}::uuid and ce.canton_id=${scope.cantonId}::uuid and ce.event_id=${scope.eventId}::uuid order by f.code`),
  db.execute<TrainingHistory>(sql`select f.name as "positionName",p.full_name as "personName",r.required,r.scheduled_on::text as "scheduledOn",r.revision,s.status,s.status_on::text as "statusOn"
  from electoral.center_training_requirements r join electoral.center_elections ce on ce.id=r.center_id join electoral.functional_areas f on f.id=r.area_id
  left join electoral.center_training_progress s on s.requirement_id=r.id left join electoral.center_area_assignments a on a.id=s.assignment_id left join electoral.people p on p.id=a.person_id
  where r.center_id=${centerId}::uuid and r.organization_id=${scope.organizationId}::uuid and r.event_id=${scope.eventId}::uuid and ce.canton_id=${scope.cantonId}::uuid and f.code<>'A09' order by r.created_at desc,r.revision desc,s.sequence desc`),
 ]);
 return {rows:[...rows],history:[...history]};
}
