import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import type { AccessContext } from "@/server/authorization/context";
import type { InventoryCommand, InventoryFilters } from "./schemas";
export type Item = { id: string; name: string; variant: string; unit: string; category: string; active: boolean; version: number };
export type Location = { id: string; name: string; kind: string; centerId: string | null };
export type Option = { id: string; name: string };
export type Movement = { attachments?:{id:string;filename:string}[]; id: string; item: string; unit: string; kind: string; quantity: string; source: string | null; destination: string | null; person: string; date: string; reason: string; origin: string; evidence: string; author: string; createdAt: string; approved: boolean | null; decisionAuthor: string | null; decisionReason: string | null };
export type Stock = { itemId: string; locationId: string; usable: string; damaged: string };
export type Need = { id: string; itemId: string; locationId: string; required: string; delivered: string; revision: number };
export async function command(scope: AccessContext, data: InventoryCommand) {
  const rows = await getDb().execute<{id:string}>(sql`select electoral.inventory_command(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${scope.eventId}::uuid,${JSON.stringify(data)}::jsonb) as id`);
  return rows[0].id;
}
export async function readHistory(scope: AccessContext, filters: InventoryFilters, limit = 501) {
  return [...await getDb().execute<Movement>(sql`select m.id,i.name||case when i.variant='' then '' else ' · '||i.variant end as item,i.unit,m.kind,m.quantity::text,s.name as source,d.name as destination,p.full_name as person,m.occurred_on::text as date,m.reason,m.origin,m.evidence,m.created_by::text as author,m.created_at::text as "createdAt",a.approved,a.created_by::text as "decisionAuthor",a.reason as "decisionReason"
    from electoral.inventory_movements m join electoral.inventory_items i on i.id=m.item_id left join electoral.inventory_locations s on s.id=m.source_id left join electoral.inventory_locations d on d.id=m.destination_id join electoral.people p on p.id=m.person_id left join electoral.inventory_decisions a on a.movement_id=m.id
    where m.organization_id=${scope.organizationId}::uuid and m.canton_id=${scope.cantonId}::uuid and m.event_id=${scope.eventId}::uuid
    ${filters.item ? sql`and m.item_id=${filters.item}::uuid` : sql``}
    ${filters.location ? sql`and (m.source_id=${filters.location}::uuid or m.destination_id=${filters.location}::uuid)` : sql``}
    ${filters.person ? sql`and m.person_id=${filters.person}::uuid` : sql``}
    ${filters.kind ? sql`and m.kind=${filters.kind}` : sql``}
    ${filters.from ? sql`and m.occurred_on>=${filters.from}::date` : sql``}
    ${filters.to ? sql`and m.occurred_on<=${filters.to}::date` : sql``}
    order by m.created_at desc,m.id limit ${limit} offset ${limit===501?(filters.page-1)*500:0}`)];
}
export async function readInventory(scope: AccessContext, filters: InventoryFilters) {
  const db = getDb();
  const [items, locations, people, districts, centers, stock, needs, history, pending] = await Promise.all([
    db.execute<Item>(sql`select id,name,variant,unit,category,active,version from electoral.inventory_items where organization_id=${scope.organizationId}::uuid and canton_id=${scope.cantonId}::uuid order by name,variant,unit`),
    db.execute<Location>(sql`select id,name,kind,center_id as "centerId" from electoral.inventory_locations where organization_id=${scope.organizationId}::uuid and canton_id=${scope.cantonId}::uuid and (event_id is null or event_id=${scope.eventId}::uuid) order by kind,name`),
    db.execute<Option>(sql`select id,full_name as name from electoral.people where organization_id=${scope.organizationId}::uuid order by full_name,id`),
    db.execute<Option>(sql`select id,name from electoral.districts where canton_id=${scope.cantonId}::uuid and active order by name`),
    db.execute<Option>(sql`select ce.id,c.name from electoral.center_elections ce join electoral.voting_centers c on c.id=ce.center_id where ce.organization_id=${scope.organizationId}::uuid and ce.canton_id=${scope.cantonId}::uuid and ce.event_id=${scope.eventId}::uuid and c.archived_at is null and ce.internal_status<>'inactivo' order by c.name,ce.id`),
    db.execute<Stock>(sql`select item_id as "itemId",location_id as "locationId",sum(usable)::text as usable,sum(damaged)::text as damaged from electoral.inventory_effects where organization_id=${scope.organizationId}::uuid and canton_id=${scope.cantonId}::uuid group by item_id,location_id order by item_id,location_id`),
    db.execute<Need>(sql`select n.id,n.item_id as "itemId",n.location_id as "locationId",n.required::text,n.revision,coalesce((select sum(case when m.destination_id=n.location_id then m.quantity else -m.quantity end) from electoral.inventory_movements m where m.item_id=n.item_id and m.event_id=n.event_id and m.organization_id=n.organization_id and m.canton_id=n.canton_id and m.kind='transferencia' and (m.destination_id=n.location_id or m.source_id=n.location_id)),0)::text as delivered
      from electoral.inventory_needs n where n.organization_id=${scope.organizationId}::uuid and n.canton_id=${scope.cantonId}::uuid and n.event_id=${scope.eventId}::uuid and not exists(select 1 from electoral.inventory_needs x where x.organization_id=n.organization_id and x.canton_id=n.canton_id and x.event_id=n.event_id and x.item_id=n.item_id and x.location_id=n.location_id and x.revision>n.revision) order by n.location_id,n.item_id`),
    readHistory(scope, filters),
    db.execute<Movement>(sql`select m.id,i.name||' '||i.variant as item,i.unit,m.kind,m.quantity::text,s.name as source,d.name as destination,p.full_name as person,m.occurred_on::text as date,m.reason,m.origin,m.evidence,m.created_by::text as author,m.created_at::text as "createdAt",null::boolean as approved,null::text as "decisionAuthor",null::text as "decisionReason" from electoral.inventory_movements m join electoral.inventory_items i on i.id=m.item_id left join electoral.inventory_locations s on s.id=m.source_id left join electoral.inventory_locations d on d.id=m.destination_id join electoral.people p on p.id=m.person_id where m.organization_id=${scope.organizationId}::uuid and m.canton_id=${scope.cantonId}::uuid and m.event_id=${scope.eventId}::uuid and m.kind in ('perdida','robo','baja') and not exists(select 1 from electoral.inventory_decisions d where d.movement_id=m.id) order by m.created_at,m.id`),
  ]);
  return { items:[...items], locations:[...locations], people:[...people], districts:[...districts], centers:[...centers], stock:[...stock], needs:[...needs], history, pending:[...pending] };
}
export async function recordExport(scope: AccessContext, count: number) {
  await getDb().execute(sql`select electoral.inventory_export_audit(${scope.userId}::uuid,${scope.organizationId}::uuid,${scope.cantonId}::uuid,${count})`);
}
