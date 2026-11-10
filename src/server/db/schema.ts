import { sql } from "drizzle-orm";
import {
  pgSchema,
  pgPolicy,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  numeric,
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
export const provinces = electoral.table("provinces", {
  id: id(),
  name: text("name").notNull().unique(),
  officialCode: text("official_code").unique(),
  sourceUrl: text("source_url").notNull(),
  ...timestamps(),
}, (t) => [
  check("province_name_length", sql`length(trim(${t.name})) between 2 and 100`),
  check("province_source_url", sql`${t.sourceUrl} ~ '^https?://[^[:space:]]+$' and length(${t.sourceUrl}) <= 1000`),
  check("province_code_format", sql`${t.officialCode} is null or ${t.officialCode} ~ '^[0-9]{1,10}$'`),
  pgPolicy("provinces_server_read", { for: "select", to: "electoral_app", using: sql`true` }),
]).enableRLS();
export const cantons = electoral.table("cantons", {
  id: id(),
  name: text("name").notNull(),
  provinceCode: text("province_code"),
  provinceId: uuid("province_id").references(() => provinces.id),
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
    unique("assignment_training_scope").on(t.id, t.organizationId, t.cantonId, t.positionId),
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
export const electionBoards = electoral.table("election_boards", {
 id:id(),organizationId:uuid("organization_id").notNull(),eventId:uuid("event_id").notNull(),centerId:uuid("center_id").notNull(),number:integer("number").notNull(),sourceReference:text("source_reference").notNull(),createdBy:uuid("created_by").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({columns:[t.centerId,t.organizationId,t.eventId],foreignColumns:[centerElections.id,centerElections.organizationId,centerElections.eventId]}),
 unique("board_number_event").on(t.organizationId,t.eventId,t.number),
 unique("board_scope").on(t.id,t.organizationId,t.eventId,t.centerId),
 check("board_number_valid",sql`${t.number}>0 AND length(trim(${t.sourceReference})) BETWEEN 3 AND 500`),
 pgPolicy("election_boards_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();
export const fiscalAssignments = electoral.table("fiscal_assignments",{
 id:id(),organizationId:uuid("organization_id").notNull(),eventId:uuid("event_id").notNull(),centerId:uuid("center_id").notNull(),boardId:uuid("board_id"),role:text("role").notNull(),personId:uuid("person_id").notNull(),
 accreditationScope:text("accreditation_scope").notNull().default(""),accreditationReference:text("accreditation_reference").notNull().default(""),
 startedAt:timestamp("started_at",{withTimezone:true}).notNull().defaultNow(),endedAt:timestamp("ended_at",{withTimezone:true}),endedReason:text("ended_reason"),createdBy:uuid("created_by").notNull(),
},t=>[
 foreignKey({columns:[t.centerId,t.organizationId,t.eventId],foreignColumns:[centerElections.id,centerElections.organizationId,centerElections.eventId]}),
 foreignKey({columns:[t.boardId,t.organizationId,t.eventId,t.centerId],foreignColumns:[electionBoards.id,electionBoards.organizationId,electionBoards.eventId,electionBoards.centerId]}),
 foreignKey({columns:[t.personId,t.organizationId],foreignColumns:[people.id,people.organizationId]}),
 check("fiscal_role_destination",sql`(${t.role} IN ('general','general_suplente') AND ${t.boardId} IS NULL) OR (${t.role} IN ('titular','suplente') AND ${t.boardId} IS NOT NULL)`),
 check("fiscal_end_valid",sql`(${t.endedAt} IS NULL AND ${t.endedReason} IS NULL) OR (${t.endedAt}>=${t.startedAt} AND length(trim(${t.endedReason})) BETWEEN 3 AND 500)`),
 check("fiscal_accreditation_length",sql`length(${t.accreditationScope})<=1000 AND length(${t.accreditationReference})<=500`),
 uniqueIndex("fiscal_board_current_role").on(t.boardId,t.role).where(sql`${t.endedAt} IS NULL AND ${t.boardId} IS NOT NULL`),
 uniqueIndex("fiscal_board_current_person").on(t.boardId,t.personId).where(sql`${t.endedAt} IS NULL AND ${t.boardId} IS NOT NULL`),
 uniqueIndex("fiscal_general_current_person").on(t.centerId,t.personId).where(sql`${t.endedAt} IS NULL AND ${t.role} IN ('general','general_suplente')`),
 uniqueIndex("fiscal_general_current_titular").on(t.centerId).where(sql`${t.endedAt} IS NULL AND ${t.role}='general'`),
 index("fiscal_center_history").on(t.centerId,t.startedAt),
 pgPolicy("fiscal_assignments_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();
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
  unique("center_assignment_training_scope").on(t.id,t.organizationId,t.eventId,t.centerElectionId,t.areaId),
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

// Public submissions are sensitive: no direct SELECT policy for the runtime.
export const transportRequests = electoral.table("transport_requests", {
  id: id(), organizationId: uuid("organization_id").notNull(), cantonId: uuid("canton_id").notNull(), eventId: uuid("event_id").notNull(),
  token: uuid("token").notNull().unique(), receipt: uuid("receipt").notNull().defaultRandom().unique(), payloadHash: text("payload_hash").notNull(),
  kind: text("kind").notNull(), name: text("name").notNull().default(""), contactChannel: text("contact_channel").notNull().default(""), contact: text("contact").notNull().default(""),
  districtId: uuid("district_id").notNull(), centerId: uuid("center_id"), desiredTime: text("desired_time").notNull().default(""), vehicleDetails: text("vehicle_details").notNull().default(""),
    status: text("status").notNull().default("pendiente"), version: integer("version").notNull().default(1), linkedPersonId: uuid("linked_person_id"), linkedVehicleId: uuid("linked_vehicle_id"),
  vehicleRequired:boolean("vehicle_required").notNull().default(true),
  reviewedBy: uuid("reviewed_by"), reviewedAt: timestamp("reviewed_at",{withTimezone:true}), reviewReason: text("review_reason").notNull().default(""), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  foreignKey({columns:[t.organizationId,t.cantonId],foreignColumns:[organizationCantons.organizationId,organizationCantons.cantonId]}),
  foreignKey({columns:[t.eventId,t.organizationId],foreignColumns:[electionEvents.id,electionEvents.organizationId]}),
  foreignKey({columns:[t.districtId,t.cantonId],foreignColumns:[districts.id,districts.cantonId]}),
  foreignKey({columns:[t.centerId,t.organizationId,t.eventId],foreignColumns:[centerElections.id,centerElections.organizationId,centerElections.eventId]}),
  foreignKey({columns:[t.linkedPersonId,t.organizationId],foreignColumns:[people.id,people.organizationId]}),
  foreignKey({columns:[t.linkedVehicleId,t.organizationId,t.cantonId],foreignColumns:[vehicles.id,vehicles.organizationId,vehicles.cantonId]}),
  check("transport_request_kind",sql`${t.kind} in ('driver','passenger') and (${t.kind}<>'driver' or (length(trim(${t.name})) between 2 and 160 and ${t.contact}<>''))`),
  check("transport_request_text",sql`length(${t.name})<=160 and length(${t.contact})<=254 and length(${t.vehicleDetails})<=160 and length(${t.reviewReason})<=500 and ${t.payloadHash} ~ '^[a-f0-9]{64}$' and ${t.version}>0 and (${t.desiredTime}='' or ${t.desiredTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')`),
  check("transport_request_contact",sql`(${t.contact}='' and ${t.contactChannel}='') or (${t.contactChannel}='telefono' and ${t.contact} ~ '^[+()0-9 .-]{6,40}$') or (${t.contactChannel}='correo' and ${t.contact} ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')`),
  check("transport_request_status",sql`${t.status}='pendiente' or (${t.kind}='driver' and ${t.status} in ('aprobada','rechazada')) or (${t.kind}='passenger' and ${t.status}='atendida')`),
  check("transport_request_vehicle_required",sql`NOT ${t.vehicleRequired} OR ${t.kind}<>'driver' OR (length(trim(${t.vehicleDetails}))>=2 AND (${t.status}<>'aprobada' OR ${t.linkedVehicleId} IS NOT NULL))`),
  index("transport_request_queue").on(t.organizationId,t.cantonId,t.eventId,t.createdAt),
]).enableRLS();

export const transportSubmissionBuckets = electoral.table("transport_submission_buckets", {
  key: text("key").notNull(), slot: integer("slot").notNull(), attempts: integer("attempts").notNull(),
},t=>[primaryKey({columns:[t.key,t.slot]}),check("transport_bucket_valid",sql`${t.attempts}>0 and length(${t.key})<=100`)]).enableRLS();

export const transportVehicleStatus = electoral.table("transport_vehicle_status", {
  vehicleId: uuid("vehicle_id").primaryKey(), organizationId: uuid("organization_id").notNull(), cantonId: uuid("canton_id").notNull(),
  approved: boolean("approved").notNull().default(false), operationalStatus: text("operational_status").notNull().default("sin_verificar"), version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by").notNull(), updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  foreignKey({columns:[t.vehicleId,t.organizationId,t.cantonId],foreignColumns:[vehicles.id,vehicles.organizationId,vehicles.cantonId]}),
  check("transport_operational_status",sql`${t.operationalStatus} in ('sin_verificar','operativo','mantenimiento','fuera_servicio') and ${t.version}>0`),
  pgPolicy("transport_status_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();

export const transportWindows = electoral.table("transport_availability_windows", {
  id:id(),vehicleId:uuid("vehicle_id").notNull(),organizationId:uuid("organization_id").notNull(),cantonId:uuid("canton_id").notNull(),eventId:uuid("event_id").notNull(),districtId:uuid("district_id").notNull(),
  startsAt:timestamp("starts_at",{withTimezone:true}).notNull(),endsAt:timestamp("ends_at",{withTimezone:true}).notNull(),createdBy:uuid("created_by").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  canceledAt:timestamp("canceled_at",{withTimezone:true}),canceledBy:uuid("canceled_by"),cancelReason:text("cancel_reason").notNull().default(""),
},t=>[
  foreignKey({columns:[t.vehicleId,t.organizationId,t.cantonId],foreignColumns:[vehicles.id,vehicles.organizationId,vehicles.cantonId]}),
  foreignKey({columns:[t.eventId,t.organizationId],foreignColumns:[electionEvents.id,electionEvents.organizationId]}),
  foreignKey({columns:[t.districtId,t.cantonId],foreignColumns:[districts.id,districts.cantonId]}),
  check("transport_window_dates",sql`${t.endsAt}>${t.startsAt} and length(${t.cancelReason})<=500`),
  index("transport_window_vehicle").on(t.vehicleId,t.eventId,t.startsAt),
  pgPolicy("transport_windows_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();

export const transportTrips = electoral.table("transport_service_trips", {
  id:id(),vehicleId:uuid("vehicle_id").notNull(),organizationId:uuid("organization_id").notNull(),cantonId:uuid("canton_id").notNull(),eventId:uuid("event_id").notNull(),districtId:uuid("district_id").notNull(),centerId:uuid("center_id"),
  startsAt:timestamp("starts_at",{withTimezone:true}).notNull(),endsAt:timestamp("ends_at",{withTimezone:true}).notNull(),title:text("title").notNull(),meetingPoint:text("meeting_point").notNull(),institutionalContact:text("institutional_contact").notNull().default(""),
  confirmed:boolean("confirmed").notNull().default(false),published:boolean("published").notNull().default(false),version:integer("version").notNull().default(1),
  createdBy:uuid("created_by").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),canceledAt:timestamp("canceled_at",{withTimezone:true}),canceledBy:uuid("canceled_by"),cancelReason:text("cancel_reason").notNull().default(""),
},t=>[
  foreignKey({columns:[t.vehicleId,t.organizationId,t.cantonId],foreignColumns:[vehicles.id,vehicles.organizationId,vehicles.cantonId]}),
  foreignKey({columns:[t.eventId,t.organizationId],foreignColumns:[electionEvents.id,electionEvents.organizationId]}),
  foreignKey({columns:[t.districtId,t.cantonId],foreignColumns:[districts.id,districts.cantonId]}),
  foreignKey({columns:[t.centerId,t.organizationId,t.eventId],foreignColumns:[centerElections.id,centerElections.organizationId,centerElections.eventId]}),
  check("transport_trip_valid",sql`${t.endsAt}>${t.startsAt} and length(trim(${t.title})) between 2 and 160 and length(trim(${t.meetingPoint})) between 2 and 300 and length(${t.institutionalContact})<=254 and length(${t.cancelReason})<=500 and ${t.version}>0 and (not ${t.published} or (${t.confirmed} and ${t.canceledAt} is null and length(trim(${t.institutionalContact}))>=3))`),
  index("transport_trip_vehicle").on(t.vehicleId,t.startsAt,t.endsAt),
  pgPolicy("transport_trips_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();

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

export const vehicles = electoral.table("vehicles", {
  id: id(), organizationId: uuid("organization_id").notNull(), cantonId: uuid("canton_id").notNull(),
  plate: text("plate").notNull(), description: text("description").notNull(),
  responsibleId: uuid("responsible_id").notNull(), active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1), ...timestamps(),
}, t => [
  unique().on(t.id, t.organizationId, t.cantonId), unique().on(t.organizationId, t.plate),
  foreignKey({ columns: [t.organizationId, t.cantonId], foreignColumns: [organizationCantons.organizationId, organizationCantons.cantonId] }),
  foreignKey({ columns: [t.responsibleId, t.organizationId], foreignColumns: [people.id, people.organizationId] }),
  check("vehicle_text", sql`${t.plate} ~ '^[A-Z0-9-]{2,20}$' AND length(trim(${t.description})) BETWEEN 2 AND 160 AND ${t.version} > 0`),
  pgPolicy("vehicles_server_read", { for: "select", to: "electoral_app", using: sql`true` }),
]).enableRLS();
export const vehicleDocuments=electoral.table("vehicle_documents",{
 id:id(),organizationId:uuid("organization_id").notNull(),cantonId:uuid("canton_id").notNull(),vehicleId:uuid("vehicle_id").notNull(),conductorId:uuid("conductor_id"),batchId:uuid("batch_id").notNull(),category:text("category").notNull(),
 storagePath:text("storage_path").notNull().unique(),filename:text("filename").notNull(),mimeType:text("mime_type").notNull(),byteSize:integer("byte_size").notNull(),sha256:text("sha256").notNull(),uploadedBy:uuid("uploaded_by").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({name:"vehicle_document_vehicle",columns:[t.vehicleId,t.organizationId,t.cantonId],foreignColumns:[vehicles.id,vehicles.organizationId,vehicles.cantonId]}),
 foreignKey({name:"vehicle_document_person",columns:[t.conductorId,t.organizationId],foreignColumns:[people.id,people.organizationId]}),
 unique("vehicle_document_batch_content").on(t.vehicleId,t.batchId,t.sha256,t.filename),
 check("vehicle_document_category",sql`(${t.category}='conductor' AND ${t.conductorId} IS NOT NULL) OR (${t.category} IN ('vehiculo','otro') AND ${t.conductorId} IS NULL)`),
 check("vehicle_document_file",sql`${t.byteSize}>0 AND ${t.byteSize}<=5242880 AND ${t.mimeType} IN ('application/pdf','image/jpeg','image/png') AND length(${t.filename}) BETWEEN 1 AND 180 AND ${t.sha256} ~ '^[a-f0-9]{64}$'`),
 pgPolicy("vehicle_documents_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();
export const vehicleRegistrations=electoral.table("vehicle_registrations",{
 id:id(),organizationId:uuid("organization_id").notNull(),cantonId:uuid("canton_id").notNull(),eventId:uuid("event_id").notNull(),vehicleId:uuid("vehicle_id").notNull(),actorId:uuid("actor_id").notNull(),payloadHash:text("payload_hash").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({name:"vehicle_registration_vehicle",columns:[t.vehicleId,t.organizationId,t.cantonId],foreignColumns:[vehicles.id,vehicles.organizationId,vehicles.cantonId]}),
 foreignKey({name:"vehicle_registration_event",columns:[t.eventId,t.organizationId],foreignColumns:[electionEvents.id,electionEvents.organizationId]}),
 check("vehicle_registration_hash",sql`${t.payloadHash} ~ '^[a-f0-9]{64}$'`),
]).enableRLS();
export const vehicleDistricts = electoral.table("vehicle_district_assignments", {
  id: id(), vehicleId: uuid("vehicle_id").notNull(), organizationId: uuid("organization_id").notNull(),
  cantonId: uuid("canton_id").notNull(), eventId: uuid("event_id").notNull(), districtId: uuid("district_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(), endedAt: timestamp("ended_at", { withTimezone: true }),
}, t => [
  foreignKey({ columns: [t.vehicleId, t.organizationId, t.cantonId], foreignColumns: [vehicles.id, vehicles.organizationId, vehicles.cantonId] }),
  foreignKey({ columns: [t.districtId, t.cantonId], foreignColumns: [districts.id, districts.cantonId] }),
  foreignKey({ columns: [t.eventId, t.organizationId], foreignColumns: [electionEvents.id, electionEvents.organizationId] }),
  uniqueIndex("vehicle_district_current").on(t.vehicleId, t.eventId, t.districtId).where(sql`${t.endedAt} IS NULL`),
  check("vehicle_district_dates", sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
  pgPolicy("vehicle_districts_server_read", { for: "select", to: "electoral_app", using: sql`true` }),
]).enableRLS();
export const vehicleCenters = electoral.table("vehicle_center_assignments", {
  id: id(), vehicleId: uuid("vehicle_id").notNull(), organizationId: uuid("organization_id").notNull(),
  cantonId: uuid("canton_id").notNull(), eventId: uuid("event_id").notNull(), centerElectionId: uuid("center_election_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(), endedAt: timestamp("ended_at", { withTimezone: true }),
}, t => [
  foreignKey({ columns: [t.vehicleId, t.organizationId, t.cantonId], foreignColumns: [vehicles.id, vehicles.organizationId, vehicles.cantonId] }),
  foreignKey({ columns: [t.centerElectionId, t.organizationId, t.eventId], foreignColumns: [centerElections.id, centerElections.organizationId, centerElections.eventId] }),
  uniqueIndex("vehicle_center_current").on(t.vehicleId, t.eventId, t.centerElectionId).where(sql`${t.endedAt} IS NULL`),
  check("vehicle_center_dates", sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
  pgPolicy("vehicle_centers_server_read", { for: "select", to: "electoral_app", using: sql`true` }),
]).enableRLS();
export const trainingRequirements = electoral.table("training_requirements", {
  id: id(), organizationId: uuid("organization_id").notNull(), cantonId: uuid("canton_id").notNull(), eventId: uuid("event_id").notNull(),
  positionId: uuid("position_id").notNull(), required: boolean("required").notNull(), scheduledOn: date("scheduled_on"),
  revision: integer("revision").notNull(), createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.positionId, t.organizationId, t.cantonId], foreignColumns: [positions.id, positions.organizationId, positions.cantonId] }),
  foreignKey({ columns: [t.eventId, t.organizationId], foreignColumns: [electionEvents.id, electionEvents.organizationId] }),
  unique().on(t.positionId, t.eventId, t.revision),
  unique("training_requirement_scope").on(t.id, t.organizationId, t.cantonId, t.eventId, t.positionId),
  check("training_requirement_revision", sql`${t.revision} > 0 AND (${t.required} OR ${t.scheduledOn} IS NULL)`),
  pgPolicy("training_requirements_server_read", { for: "select", to: "electoral_app", using: sql`true` }),
]).enableRLS();
export const trainingProgress = electoral.table("training_progress", {
  id: id(), requirementId: uuid("requirement_id").notNull(), assignmentId: uuid("assignment_id").notNull(),
  organizationId: uuid("organization_id").notNull(), cantonId: uuid("canton_id").notNull(), eventId: uuid("event_id").notNull(), positionId: uuid("position_id").notNull(),
  status: text("status", { enum: ["pendiente", "convocado", "cumplido", "no_asistio"] }).notNull(),
  statusOn: date("status_on").notNull(), sequence: integer("sequence").notNull(), createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.requirementId, t.organizationId, t.cantonId, t.eventId, t.positionId], foreignColumns: [trainingRequirements.id, trainingRequirements.organizationId, trainingRequirements.cantonId, trainingRequirements.eventId, trainingRequirements.positionId] }),
  foreignKey({ columns: [t.assignmentId, t.organizationId, t.cantonId, t.positionId], foreignColumns: [assignments.id, assignments.organizationId, assignments.cantonId, assignments.positionId] }),
  unique().on(t.requirementId, t.assignmentId, t.sequence),
  check("training_progress_status", sql`${t.status} IN ('pendiente','convocado','cumplido','no_asistio') AND ${t.sequence} > 0`),
  pgPolicy("training_progress_server_read", { for: "select", to: "electoral_app", using: sql`true` }),
]).enableRLS();

export const centerTrainingRequirements = electoral.table("center_training_requirements", {
  id:id(), organizationId:uuid("organization_id").notNull(), eventId:uuid("event_id").notNull(), centerId:uuid("center_id").notNull(), areaId:uuid("area_id").notNull(),
  required:boolean("required").notNull(), scheduledOn:date("scheduled_on"), revision:integer("revision").notNull(), createdBy:uuid("created_by").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({columns:[t.centerId,t.organizationId,t.eventId],foreignColumns:[centerElections.id,centerElections.organizationId,centerElections.eventId]}),
 foreignKey({columns:[t.areaId,t.organizationId],foreignColumns:[functionalAreas.id,functionalAreas.organizationId]}),
 unique("center_training_revision").on(t.centerId,t.areaId,t.revision),
 unique("center_training_scope").on(t.id,t.organizationId,t.eventId,t.centerId,t.areaId),
 check("center_training_requirement_valid",sql`${t.revision}>0 AND (${t.required} OR ${t.scheduledOn} IS NULL)`),
 pgPolicy("center_training_requirements_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();
export const centerTrainingProgress = electoral.table("center_training_progress", {
 id:id(),organizationId:uuid("organization_id").notNull(),eventId:uuid("event_id").notNull(),centerId:uuid("center_id").notNull(),areaId:uuid("area_id").notNull(),
 requirementId:uuid("requirement_id").notNull(),assignmentId:uuid("assignment_id").notNull(),status:text("status").notNull(),statusOn:date("status_on").notNull(),sequence:integer("sequence").notNull(),createdBy:uuid("created_by").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({columns:[t.requirementId,t.organizationId,t.eventId,t.centerId,t.areaId],foreignColumns:[centerTrainingRequirements.id,centerTrainingRequirements.organizationId,centerTrainingRequirements.eventId,centerTrainingRequirements.centerId,centerTrainingRequirements.areaId]}),
 foreignKey({columns:[t.assignmentId,t.organizationId,t.eventId,t.centerId,t.areaId],foreignColumns:[centerAreaAssignments.id,centerAreaAssignments.organizationId,centerAreaAssignments.eventId,centerAreaAssignments.centerElectionId,centerAreaAssignments.areaId]}),
 unique("center_training_sequence").on(t.requirementId,t.assignmentId,t.sequence),
 check("center_training_progress_valid",sql`${t.sequence}>0 AND ${t.status} IN ('pendiente','convocado','cumplido','no_asistio')`),
 pgPolicy("center_training_progress_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();
// Inventario: stock permanente por organización/cantón; distribución por evento.
const inventoryScope = () => ({ organizationId: uuid("organization_id").notNull(), cantonId: uuid("canton_id").notNull() });
export const inventoryItems = electoral.table("inventory_items", {
  id: id(), ...inventoryScope(), name: text("name").notNull(), variant: text("variant").notNull().default(""),
  unit: text("unit").notNull(), category: text("category").notNull(), active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1), ...timestamps(),
}, t => [
  unique("inventory_item_scope").on(t.id,t.organizationId,t.cantonId),
  uniqueIndex("inventory_item_identity").on(t.organizationId,t.cantonId,sql`lower(trim(${t.name}))`,sql`lower(trim(${t.variant}))`,t.unit),
  foreignKey({name:"inventory_item_canton",columns:[t.organizationId,t.cantonId],foreignColumns:[organizationCantons.organizationId,organizationCantons.cantonId]}),
  check("inventory_item_text",sql`length(trim(${t.name})) between 2 and 120 and length(${t.variant}) <= 100 and length(trim(${t.category})) between 2 and 80 and ${t.unit} in ('pieza','caja','paquete','docena','metro','litro','kilogramo') and ${t.version} > 0`),
  pgPolicy("inventory_items_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]);
export const inventoryLocations = electoral.table("inventory_locations", {
  id: id(), ...inventoryScope(), name: text("name").notNull(), kind: text("kind").notNull(),
  districtId: uuid("district_id"), centerId: uuid("center_id"), personId: uuid("person_id"),
  eventId: uuid("event_id"), createdBy: uuid("created_by").notNull(), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  unique("inventory_location_scope").on(t.id,t.organizationId,t.cantonId),
  uniqueIndex("inventory_location_name").on(t.organizationId,t.cantonId,sql`lower(trim(${t.name}))`).where(sql`${t.kind}='almacen'`),
  uniqueIndex("inventory_location_district").on(t.organizationId,t.cantonId,t.districtId).where(sql`${t.kind}='distrito'`),
  uniqueIndex("inventory_location_center").on(t.organizationId,t.cantonId,t.centerId).where(sql`${t.kind}='centro'`),
  uniqueIndex("inventory_location_person").on(t.organizationId,t.cantonId,t.personId).where(sql`${t.kind}='persona'`),
  foreignKey({name:"inventory_location_canton",columns:[t.organizationId,t.cantonId],foreignColumns:[organizationCantons.organizationId,organizationCantons.cantonId]}),
  foreignKey({name:"inventory_location_district_fk",columns:[t.districtId,t.cantonId],foreignColumns:[districts.id,districts.cantonId]}),
  foreignKey({name:"inventory_location_center_fk",columns:[t.centerId,t.organizationId,t.eventId],foreignColumns:[centerElections.id,centerElections.organizationId,centerElections.eventId]}),
  foreignKey({name:"inventory_location_person_fk",columns:[t.personId,t.organizationId],foreignColumns:[people.id,people.organizationId]}),
  check("inventory_location_kind",sql`length(trim(${t.name})) between 2 and 160 and ((${t.kind}='almacen' and ${t.districtId} is null and ${t.centerId} is null and ${t.personId} is null and ${t.eventId} is null) or (${t.kind}='distrito' and ${t.districtId} is not null and ${t.centerId} is null and ${t.personId} is null and ${t.eventId} is null) or (${t.kind}='centro' and ${t.centerId} is not null and ${t.eventId} is not null and ${t.districtId} is null and ${t.personId} is null) or (${t.kind}='persona' and ${t.personId} is not null and ${t.districtId} is null and ${t.centerId} is null and ${t.eventId} is null))`),
  pgPolicy("inventory_locations_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]);
export const inventoryMovements = electoral.table("inventory_movements", {
  id: id(), ...inventoryScope(), eventId: uuid("event_id").notNull(), itemId: uuid("item_id").notNull(),
  kind: text("kind").notNull(), quantity: numeric("quantity",{precision:14,scale:3}).notNull(),
  sourceId: uuid("source_id"), destinationId: uuid("destination_id"), personId: uuid("person_id").notNull(),
  occurredOn: date("occurred_on").notNull(), origin: text("origin").notNull().default(""), reason: text("reason").notNull(), evidence: text("evidence").notNull().default(""),
  requestId: uuid("request_id").notNull(), createdBy: uuid("created_by").notNull(), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  unique("inventory_movement_scope").on(t.id,t.organizationId,t.cantonId), unique("inventory_movement_request").on(t.organizationId,t.cantonId,t.requestId),
  unique("inventory_movement_receipt_scope").on(t.id,t.organizationId,t.cantonId,t.eventId),
  foreignKey({name:"inventory_movement_item",columns:[t.itemId,t.organizationId,t.cantonId],foreignColumns:[inventoryItems.id,inventoryItems.organizationId,inventoryItems.cantonId]}),
  foreignKey({name:"inventory_movement_source",columns:[t.sourceId,t.organizationId,t.cantonId],foreignColumns:[inventoryLocations.id,inventoryLocations.organizationId,inventoryLocations.cantonId]}),
  foreignKey({name:"inventory_movement_destination",columns:[t.destinationId,t.organizationId,t.cantonId],foreignColumns:[inventoryLocations.id,inventoryLocations.organizationId,inventoryLocations.cantonId]}),
  foreignKey({name:"inventory_movement_event",columns:[t.eventId,t.organizationId],foreignColumns:[electionEvents.id,electionEvents.organizationId]}),
  foreignKey({name:"inventory_movement_person",columns:[t.personId,t.organizationId],foreignColumns:[people.id,people.organizationId]}),
  check("inventory_movement_data",sql`${t.quantity} > 0 and ${t.quantity} <> 'NaN'::numeric and length(trim(${t.reason})) between 3 and 500 and length(${t.evidence}) <= 500 and length(${t.origin}) <= 160 and (${t.kind}<>'ingreso' or length(trim(${t.origin})) >= 2) and ((${t.kind}='ingreso' and ${t.sourceId} is null and ${t.destinationId} is not null) or (${t.kind}='transferencia' and ${t.sourceId} is not null and ${t.destinationId} is not null and ${t.sourceId}<>${t.destinationId}) or (${t.kind} in ('consumo','dano','perdida','robo','baja') and ${t.sourceId} is not null and ${t.destinationId} is null))`),
  index("inventory_movement_scope_date").on(t.organizationId,t.cantonId,t.occurredOn),
  pgPolicy("inventory_movements_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]);
export const inventoryReceipts = electoral.table("inventory_receipts",{
 id:id(),...inventoryScope(),eventId:uuid("event_id").notNull(),movementId:uuid("movement_id").notNull(),storagePath:text("storage_path").notNull().unique(),filename:text("filename").notNull(),mimeType:text("mime_type").notNull(),byteSize:integer("byte_size").notNull(),sha256:text("sha256").notNull(),uploadedBy:uuid("uploaded_by").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({name:"inventory_receipt_movement",columns:[t.movementId,t.organizationId,t.cantonId,t.eventId],foreignColumns:[inventoryMovements.id,inventoryMovements.organizationId,inventoryMovements.cantonId,inventoryMovements.eventId]}),
 unique("inventory_receipt_content").on(t.movementId,t.sha256,t.filename),
 check("inventory_receipt_valid",sql`${t.byteSize}>0 AND ${t.byteSize}<=5242880 AND ${t.mimeType} IN ('application/pdf','image/jpeg','image/png') AND length(${t.filename}) BETWEEN 1 AND 180 AND ${t.sha256} ~ '^[a-f0-9]{64}$'`),
 pgPolicy("inventory_receipts_read",{for:"select",to:"electoral_app",using:sql`true`}),
]).enableRLS();
export const inventoryDecisions = electoral.table("inventory_decisions", {
  id: id(), ...inventoryScope(), movementId: uuid("movement_id").notNull().unique(), approved: boolean("approved").notNull(),
  reason: text("reason").notNull(), createdBy: uuid("created_by").notNull(), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  foreignKey({name:"inventory_decision_movement",columns:[t.movementId,t.organizationId,t.cantonId],foreignColumns:[inventoryMovements.id,inventoryMovements.organizationId,inventoryMovements.cantonId]}),
  check("inventory_decision_reason",sql`length(trim(${t.reason})) between 3 and 500`),
  pgPolicy("inventory_decisions_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]);
export const inventoryNeeds = electoral.table("inventory_needs", {
  id: id(), ...inventoryScope(), eventId: uuid("event_id").notNull(), itemId: uuid("item_id").notNull(), locationId: uuid("location_id").notNull(),
  required: numeric("required",{precision:14,scale:3}).notNull(), revision: integer("revision").notNull(),
  createdBy: uuid("created_by").notNull(), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  unique("inventory_need_revision").on(t.organizationId,t.cantonId,t.eventId,t.itemId,t.locationId,t.revision),
  foreignKey({name:"inventory_need_item",columns:[t.itemId,t.organizationId,t.cantonId],foreignColumns:[inventoryItems.id,inventoryItems.organizationId,inventoryItems.cantonId]}),
  foreignKey({name:"inventory_need_location",columns:[t.locationId,t.organizationId,t.cantonId],foreignColumns:[inventoryLocations.id,inventoryLocations.organizationId,inventoryLocations.cantonId]}),
  foreignKey({name:"inventory_need_event",columns:[t.eventId,t.organizationId],foreignColumns:[electionEvents.id,electionEvents.organizationId]}),
  check("inventory_need_quantity",sql`${t.required} >= 0 and ${t.required} <> 'NaN'::numeric and ${t.revision} > 0`),
  pgPolicy("inventory_needs_server_read",{for:"select",to:"electoral_app",using:sql`true`}),
]);
