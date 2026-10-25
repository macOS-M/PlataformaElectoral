import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  doublePrecision,
  jsonb,
  unique,
  uniqueIndex,
  primaryKey,
  foreignKey,
  check,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const electoral = pgSchema("electoral");
const id = () => uuid("id").primaryKey().defaultRandom();
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
// Supabase administra auth.users; la FK se añade en la migración de seguridad.
export const organizations = electoral.table("organizations", {
  id: id(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps(),
});
export const cantons = electoral.table("cantons", {
  id: id(),
  name: text("name").notNull(),
  provinceCode: text("province_code"),
  officialCode: text("official_code").unique(),
  ...timestamps(),
});
export const districts = electoral.table(
  "districts",
  {
    id: id(),
    cantonId: uuid("canton_id")
      .notNull()
      .references(() => cantons.id),
    name: text("name").notNull(),
    officialCode: text("official_code"),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique().on(t.id, t.cantonId),
    unique().on(t.cantonId, t.officialCode),
    index("district_canton_idx").on(t.cantonId),
  ],
);
export const organizationCantons = electoral.table(
  "organization_cantons",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    cantonId: uuid("canton_id")
      .notNull()
      .references(() => cantons.id),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.cantonId] })],
);
export const memberships = electoral.table(
  "organization_memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("admin"),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    check("membership_role", sql`${t.role} = 'admin'`),
  ],
);
export const functionalAreas = electoral.table(
  "functional_areas",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.organizationId, t.code),
  ],
);
export const sectoralMovements = electoral.table(
  "sectoral_movements",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.organizationId, t.normalizedName),
  ],
);
export const positions = electoral.table(
  "organizational_positions",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull(),
    cantonId: uuid("canton_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: text("kind", {
      enum: [
        "general",
        "district",
        "district_substitute",
        "area",
        "area_link",
        "movement",
        "movement_link",
      ],
    }).notNull(),
    districtId: uuid("district_id"),
    functionalAreaId: uuid("functional_area_id"),
    sectoralMovementId: uuid("sectoral_movement_id"),
    parentPositionId: uuid("parent_position_id").references(
      (): AnyPgColumn => positions.id,
    ),
    active: boolean("active").notNull().default(true),
    countsForCoverage: boolean("counts_for_coverage").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique().on(t.organizationId, t.cantonId, t.code),
    unique().on(t.id, t.organizationId, t.cantonId),
    foreignKey({
      columns: [t.organizationId, t.cantonId],
      foreignColumns: [
        organizationCantons.organizationId,
        organizationCantons.cantonId,
      ],
    }),
    foreignKey({
      columns: [t.districtId, t.cantonId],
      foreignColumns: [districts.id, districts.cantonId],
    }),
    foreignKey({
      columns: [t.functionalAreaId, t.organizationId],
      foreignColumns: [functionalAreas.id, functionalAreas.organizationId],
    }),
    foreignKey({
      columns: [t.sectoralMovementId, t.organizationId],
      foreignColumns: [sectoralMovements.id, sectoralMovements.organizationId],
    }),
    foreignKey({
      name: "position_parent_scope_fk",
      columns: [t.parentPositionId, t.organizationId, t.cantonId],
      foreignColumns: [t.id, t.organizationId, t.cantonId],
    }),
    check(
      "position_scope",
      sql`(${t.kind} = 'general' AND ${t.districtId} IS NULL AND ${t.functionalAreaId} IS NULL AND ${t.sectoralMovementId} IS NULL) OR (${t.kind} IN ('district', 'district_substitute') AND ${t.districtId} IS NOT NULL AND ${t.functionalAreaId} IS NULL AND ${t.sectoralMovementId} IS NULL) OR (${t.kind} = 'area' AND ${t.districtId} IS NULL AND ${t.functionalAreaId} IS NOT NULL AND ${t.sectoralMovementId} IS NULL) OR (${t.kind} = 'area_link' AND ${t.districtId} IS NOT NULL AND ${t.functionalAreaId} IS NOT NULL AND ${t.sectoralMovementId} IS NULL) OR (${t.kind} IN ('movement', 'movement_link') AND ${t.functionalAreaId} IS NULL AND ${t.sectoralMovementId} IS NOT NULL)`,
    ),
    check(
      "position_not_self_parent",
      sql`${t.parentPositionId} IS DISTINCT FROM ${t.id}`,
    ),
    uniqueIndex("one_general_position")
      .on(t.organizationId, t.cantonId)
      .where(sql`${t.active} AND ${t.kind} = 'general'`),
    uniqueIndex("one_district_position")
      .on(t.organizationId, t.districtId)
      .where(sql`${t.active} AND ${t.kind} = 'district'`),
    uniqueIndex("one_area_position")
      .on(t.organizationId, t.cantonId, t.functionalAreaId)
      .where(sql`${t.active} AND ${t.kind} = 'area'`),
  ],
);
export const electionEvents = electoral.table(
  "election_events",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    electionDate: date("election_date"),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps(),
  },
  (t) => [unique().on(t.id, t.organizationId)],
);
export const votingCenters = electoral.table(
  "voting_centers",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    address: text("address").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    contactPhone: text("contact_phone"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    check(
      "center_coordinates",
      sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL AND ${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`,
    ),
    check(
      "center_required_text",
      sql`length(trim(${t.name})) > 0 AND length(trim(${t.address})) > 0`,
    ),
  ],
);
export const centerElections = electoral.table(
  "center_elections",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull(),
    centerId: uuid("center_id").notNull(),
    eventId: uuid("event_id").notNull(),
    cantonId: uuid("canton_id").notNull(),
    districtId: uuid("district_id").notNull(),
    tseCode: text("tse_code"),
    electoralDistrictCode: text("electoral_district_code"),
    internalStatus: text("internal_status", {
      enum: ["borrador", "pendiente", "validado", "inactivo"],
    })
      .notNull()
      .default("borrador"),
    officialStatus: text("official_status").notNull().default("sin_verificar"),
    reportedBoardCount: integer("reported_board_count"),
    dataSource: text("data_source").notNull().default("manual"),
    sourceReference: text("source_reference"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique().on(t.centerId, t.eventId),
    unique().on(t.id, t.organizationId, t.eventId),
    uniqueIndex("official_center_code_event")
      .on(t.organizationId, t.eventId, t.tseCode)
      .where(sql`${t.tseCode} IS NOT NULL`),
    foreignKey({
      columns: [t.organizationId, t.cantonId],
      foreignColumns: [
        organizationCantons.organizationId,
        organizationCantons.cantonId,
      ],
    }),
    foreignKey({
      columns: [t.centerId, t.organizationId],
      foreignColumns: [votingCenters.id, votingCenters.organizationId],
    }),
    foreignKey({
      columns: [t.eventId, t.organizationId],
      foreignColumns: [electionEvents.id, electionEvents.organizationId],
    }),
    foreignKey({
      columns: [t.districtId, t.cantonId],
      foreignColumns: [districts.id, districts.cantonId],
    }),
    check(
      "center_board_count",
      sql`${t.reportedBoardCount} IS NULL OR ${t.reportedBoardCount} >= 0`,
    ),
    check(
      "center_internal_status",
      sql`${t.internalStatus} IN ('borrador', 'pendiente', 'validado', 'inactivo')`,
    ),
    check(
      "center_source",
      sql`${t.dataSource} IN ('manual', 'oficial', 'demo')`,
    ),
    check(
      "center_official_status",
      sql`${t.officialStatus} IN ('sin_verificar', 'ratificado', 'no_ratificado')`,
    ),
    check(
      "center_official_evidence",
      sql`${t.officialStatus} = 'sin_verificar' OR (${t.dataSource} = 'oficial' AND ${t.sourceReference} IS NOT NULL AND ${t.verifiedAt} IS NOT NULL)`,
    ),
    check(
      "center_demo_not_official",
      sql`${t.dataSource} <> 'demo' OR (${t.tseCode} IS NULL AND ${t.officialStatus} = 'sin_verificar')`,
    ),
    index("center_scope_idx").on(
      t.organizationId,
      t.cantonId,
      t.eventId,
      t.districtId,
    ),
  ],
);
export const auditLogs = electoral.table("audit_logs", {
  id: id(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  actorUserId: uuid("actor_user_id"),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
