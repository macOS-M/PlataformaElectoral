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
    role: text("role").notNull().default("member"),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    check("membership_role", sql`${t.role} IN ('admin', 'member')`),
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
export const people = electoral.table(
  "people",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    unique("person_org_unique").on(t.id, t.organizationId),
    check(
      "person_name_required",
      sql`length(trim(${t.fullName})) BETWEEN 2 AND 160`,
    ),
    index("people_org_idx").on(t.organizationId),
  ],
);
export const assignments = electoral.table(
  "organizational_assignments",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull(),
    cantonId: uuid("canton_id").notNull(),
    positionId: uuid("position_id").notNull(),
    personId: uuid("person_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
    createdBy: uuid("created_by").notNull(),
  },
  (t) => [
    foreignKey({
      name: "assignment_position_scope_fk",
      columns: [t.positionId, t.organizationId, t.cantonId],
      foreignColumns: [
        positions.id,
        positions.organizationId,
        positions.cantonId,
      ],
    }),
    foreignKey({
      name: "assignment_person_scope_fk",
      columns: [t.personId, t.organizationId],
      foreignColumns: [people.id, people.organizationId],
    }),
    uniqueIndex("one_current_assignment")
      .on(t.positionId)
      .where(sql`${t.endedAt} IS NULL`),
    check(
      "assignment_dates",
      sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`,
    ),
    check(
      "assignment_end_reason",
      sql`(${t.endedAt} IS NULL AND ${t.endedReason} IS NULL) OR (${t.endedAt} IS NOT NULL AND length(trim(${t.endedReason})) BETWEEN 3 AND 500)`,
    ),
    index("assignment_person_idx").on(t.organizationId, t.personId),
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

export const centerAreaAssignments = electoral.table("center_area_assignments", {
  id: id(),
  organizationId: uuid("organization_id").notNull(),
  centerElectionId: uuid("center_election_id").notNull(),
  eventId: uuid("event_id").notNull(),
  areaId: uuid("area_id").notNull(),
  personId: uuid("person_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endedReason: text("ended_reason"),
  createdBy: uuid("created_by").notNull(),
}, t => [
  foreignKey({ columns: [t.centerElectionId, t.organizationId, t.eventId], foreignColumns: [centerElections.id, centerElections.organizationId, centerElections.eventId] }),
  foreignKey({ columns: [t.areaId, t.organizationId], foreignColumns: [functionalAreas.id, functionalAreas.organizationId] }),
  foreignKey({ columns: [t.personId, t.organizationId], foreignColumns: [people.id, people.organizationId] }),
  uniqueIndex("center_area_current").on(t.centerElectionId, t.areaId).where(sql`${t.endedAt} IS NULL`),
  check("center_area_end", sql`(${t.endedAt} IS NULL AND ${t.endedReason} IS NULL) OR (${t.endedAt} >= ${t.startedAt} AND length(trim(${t.endedReason})) BETWEEN 3 AND 500)`),
]);

export const centerAreaDocuments = electoral.table("center_area_documents", {
  id: id(),
  organizationId: uuid("organization_id").notNull(),
  centerElectionId: uuid("center_election_id").notNull(),
  eventId: uuid("event_id").notNull(),
  areaId: uuid("area_id").notNull(),
  storagePath: text("storage_path").notNull().unique(),
  filename: text("filename").notNull(),
  category: text("category").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.centerElectionId, t.organizationId, t.eventId], foreignColumns: [centerElections.id, centerElections.organizationId, centerElections.eventId] }),
  foreignKey({ columns: [t.areaId, t.organizationId], foreignColumns: [functionalAreas.id, functionalAreas.organizationId] }),
  check("center_document_size", sql`${t.byteSize} BETWEEN 1 AND 5242880`),
  check("center_document_type", sql`${t.mimeType} IN ('application/pdf','image/jpeg','image/png')`),
  check("center_document_category", sql`${t.category} IN ('contrato','cedula','otro')`),
]);

export const modulePermissions = electoral.table(
  "module_permissions",
  {
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    cantonId: uuid("canton_id").notNull(),
    module: text("module").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId, t.cantonId, t.module] }),
    foreignKey({
      name: "permission_membership_fk",
      columns: [t.organizationId, t.userId],
      foreignColumns: [memberships.organizationId, memberships.userId],
    }),
    foreignKey({
      name: "permission_scope_fk",
      columns: [t.organizationId, t.cantonId],
      foreignColumns: [
        organizationCantons.organizationId,
        organizationCantons.cantonId,
      ],
    }),
    check(
      "permission_module",
      sql`${t.module} IN ('district','organigrama','centros','A01','A02','A03','A04','A05','A06','A07','A08','A09')`,
    ),
  ],
);
export const registrationAuthorizations = electoral.table(
  "registration_authorizations",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    cantonId: uuid("canton_id").notNull(),
    identifierHash: text("identifier_hash").notNull().unique(),
    identifierHint: text("identifier_hint").notNull(),
    activationHash: text("activation_hash"),
    role: text("role").notNull().default("member"),
    modules: text("modules")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    authorizedBy: uuid("authorized_by").notNull(),
    userId: uuid("user_id").unique(),
    active: boolean("active").notNull().default(true),
    claimToken: uuid("claim_token"),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "registration_scope_fk",
      columns: [t.organizationId, t.cantonId],
      foreignColumns: [
        organizationCantons.organizationId,
        organizationCantons.cantonId,
      ],
    }),
    check("registration_role", sql`${t.role} IN ('admin','member')`),
    check(
      "registration_modules",
      sql`${t.modules} <@ ARRAY['district','organigrama','centros','A01','A02','A03','A04','A05','A06','A07','A08','A09']::text[]`,
    ),
  ],
);
export const authAttempts = electoral.table("auth_attempts", {
  key: text("key").primaryKey(),
  windowStarted: timestamp("window_started", { withTimezone: true })
    .notNull()
    .defaultNow(),
  attempts: integer("attempts").notNull().default(1),
});

export const userPeople = electoral.table(
  "user_people",
  {
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    personId: uuid("person_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    unique("user_person_unique").on(t.organizationId, t.personId),
    foreignKey({
      name: "user_person_membership_fk",
      columns: [t.organizationId, t.userId],
      foreignColumns: [memberships.organizationId, memberships.userId],
    }),
    foreignKey({
      name: "user_person_person_fk",
      columns: [t.personId, t.organizationId],
      foreignColumns: [people.id, people.organizationId],
    }),
  ],
);
