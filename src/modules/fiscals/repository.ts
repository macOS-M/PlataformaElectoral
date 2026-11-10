import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { BoardInput,FiscalInput,FiscalRole } from "./schemas";
export type Board={id:string;number:number;sourceReference:string};
export type Fiscal={id:string;boardId:string|null;role:FiscalRole;personId:string;personName:string;accreditationScope:string;accreditationReference:string;startedAt:string;endedAt:string|null;endedReason:string|null};
export type FiscalPerson={id:string;fullName:string};
export async function readFiscals(scope:AccessContext,centerId:string){
 const db=getDb();
 const [boards,assignments,people]=await Promise.all([
  db.execute<Board>(sql`select b.id,b.number,b.source_reference as "sourceReference" from electoral.election_boards b join electoral.center_elections ce on ce.id=b.center_id where b.center_id=${centerId}::uuid and b.organization_id=${scope.organizationId}::uuid and b.event_id=${scope.eventId}::uuid and ce.canton_id=${scope.cantonId}::uuid order by b.number,b.id`),
  db.execute<Fiscal>(sql`select a.id,a.board_id as "boardId",a.role,a.person_id as "personId",p.full_name as "personName",a.accreditation_scope as "accreditationScope",a.accreditation_reference as "accreditationReference",a.started_at::text as "startedAt",a.ended_at::text as "endedAt",a.ended_reason as "endedReason" from electoral.fiscal_assignments a join electoral.people p on p.id=a.person_id and p.organization_id=a.organization_id join electoral.center_elections ce on ce.id=a.center_id where a.center_id=${centerId}::uuid and a.organization_id=${scope.organizationId}::uuid and a.event_id=${scope.eventId}::uuid and ce.canton_id=${scope.cantonId}::uuid order by a.started_at desc,a.id`),
  db.execute<FiscalPerson>(sql`select id,full_name as "fullName" from electoral.people where organization_id=${scope.organizationId}::uuid order by full_name,id`),
 ]);
 return {boards:[...boards],assignments:[...assignments],people:[...people]};
}
export async function createBoard(scope:AccessContext,data:BoardInput){return getDb().execute(sql`select electoral.create_election_board(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.centerId}::uuid,${data.number},${data.sourceReference})`);}
export async function setFiscal(scope:AccessContext,data:FiscalInput){return getDb().execute(sql`select electoral.set_center_fiscal(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${data.centerId}::uuid,${data.boardId||null}::uuid,${data.role},${data.expectedId||null}::uuid,${data.personId||null}::uuid,${data.accreditationScope},${data.accreditationReference},${data.reason})`);}
