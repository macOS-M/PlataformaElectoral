CREATE SCHEMA "electoral";
--> statement-breakpoint
CREATE TABLE "electoral"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electoral"."cantons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"province_code" text,
	"official_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cantons_official_code_unique" UNIQUE("official_code")
);
--> statement-breakpoint
CREATE TABLE "electoral"."center_elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"center_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"tse_code" text,
	"electoral_district_code" text,
	"internal_status" text DEFAULT 'borrador' NOT NULL,
	"official_status" text DEFAULT 'sin_verificar' NOT NULL,
	"reported_board_count" integer,
	"data_source" text DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "center_elections_center_id_event_id_unique" UNIQUE("center_id","event_id"),
	CONSTRAINT "center_elections_id_organization_id_event_id_unique" UNIQUE("id","organization_id","event_id"),
	CONSTRAINT "center_board_count" CHECK ("electoral"."center_elections"."reported_board_count" IS NULL OR "electoral"."center_elections"."reported_board_count" >= 0),
	CONSTRAINT "center_internal_status" CHECK ("electoral"."center_elections"."internal_status" IN ('borrador', 'pendiente', 'validado', 'inactivo')),
	CONSTRAINT "center_source" CHECK ("electoral"."center_elections"."data_source" IN ('manual', 'oficial', 'demo')),
	CONSTRAINT "center_official_status" CHECK ("electoral"."center_elections"."official_status" IN ('sin_verificar', 'ratificado', 'no_ratificado')),
	CONSTRAINT "center_official_evidence" CHECK ("electoral"."center_elections"."official_status" = 'sin_verificar' OR ("electoral"."center_elections"."data_source" = 'oficial' AND "electoral"."center_elections"."source_reference" IS NOT NULL AND "electoral"."center_elections"."verified_at" IS NOT NULL)),
	CONSTRAINT "center_demo_not_official" CHECK ("electoral"."center_elections"."data_source" <> 'demo' OR ("electoral"."center_elections"."tse_code" IS NULL AND "electoral"."center_elections"."official_status" = 'sin_verificar'))
);
--> statement-breakpoint
CREATE TABLE "electoral"."districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canton_id" uuid NOT NULL,
	"name" text NOT NULL,
	"official_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "districts_id_canton_id_unique" UNIQUE("id","canton_id"),
	CONSTRAINT "districts_canton_id_official_code_unique" UNIQUE("canton_id","official_code")
);
--> statement-breakpoint
CREATE TABLE "electoral"."election_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"election_date" date,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "election_events_id_organization_id_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "electoral"."functional_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "functional_areas_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "functional_areas_organization_id_code_unique" UNIQUE("organization_id","code")
);
--> statement-breakpoint
CREATE TABLE "electoral"."organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id"),
	CONSTRAINT "membership_role" CHECK ("electoral"."organization_memberships"."role" = 'admin')
);
--> statement-breakpoint
CREATE TABLE "electoral"."organization_cantons" (
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_cantons_organization_id_canton_id_pk" PRIMARY KEY("organization_id","canton_id")
);
--> statement-breakpoint
CREATE TABLE "electoral"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electoral"."organizational_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"canton_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"district_id" uuid,
	"functional_area_id" uuid,
	"sectoral_movement_id" uuid,
	"parent_position_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"counts_for_coverage" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizational_positions_organization_id_canton_id_code_unique" UNIQUE("organization_id","canton_id","code"),
	CONSTRAINT "organizational_positions_id_organization_id_canton_id_unique" UNIQUE("id","organization_id","canton_id"),
	CONSTRAINT "position_scope" CHECK (("electoral"."organizational_positions"."kind" = 'general' AND "electoral"."organizational_positions"."district_id" IS NULL AND "electoral"."organizational_positions"."functional_area_id" IS NULL AND "electoral"."organizational_positions"."sectoral_movement_id" IS NULL) OR ("electoral"."organizational_positions"."kind" IN ('district', 'district_substitute') AND "electoral"."organizational_positions"."district_id" IS NOT NULL AND "electoral"."organizational_positions"."functional_area_id" IS NULL AND "electoral"."organizational_positions"."sectoral_movement_id" IS NULL) OR ("electoral"."organizational_positions"."kind" = 'area' AND "electoral"."organizational_positions"."district_id" IS NULL AND "electoral"."organizational_positions"."functional_area_id" IS NOT NULL AND "electoral"."organizational_positions"."sectoral_movement_id" IS NULL) OR ("electoral"."organizational_positions"."kind" = 'area_link' AND "electoral"."organizational_positions"."district_id" IS NOT NULL AND "electoral"."organizational_positions"."functional_area_id" IS NOT NULL AND "electoral"."organizational_positions"."sectoral_movement_id" IS NULL) OR ("electoral"."organizational_positions"."kind" IN ('movement', 'movement_link') AND "electoral"."organizational_positions"."functional_area_id" IS NULL AND "electoral"."organizational_positions"."sectoral_movement_id" IS NOT NULL)),
	CONSTRAINT "position_not_self_parent" CHECK ("electoral"."organizational_positions"."parent_position_id" IS DISTINCT FROM "electoral"."organizational_positions"."id")
);
--> statement-breakpoint
CREATE TABLE "electoral"."sectoral_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sectoral_movements_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "sectoral_movements_organization_id_normalized_name_unique" UNIQUE("organization_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "electoral"."voting_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"contact_phone" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voting_centers_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "center_coordinates" CHECK (("electoral"."voting_centers"."latitude" IS NULL AND "electoral"."voting_centers"."longitude" IS NULL) OR ("electoral"."voting_centers"."latitude" IS NOT NULL AND "electoral"."voting_centers"."longitude" IS NOT NULL AND "electoral"."voting_centers"."latitude" BETWEEN -90 AND 90 AND "electoral"."voting_centers"."longitude" BETWEEN -180 AND 180)),
	CONSTRAINT "center_required_text" CHECK (length(trim("electoral"."voting_centers"."name")) > 0 AND length(trim("electoral"."voting_centers"."address")) > 0)
);
--> statement-breakpoint
ALTER TABLE "electoral"."audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_elections" ADD CONSTRAINT "center_elections_organization_id_canton_id_organization_cantons_organization_id_canton_id_fk" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_elections" ADD CONSTRAINT "center_elections_center_id_organization_id_voting_centers_id_organization_id_fk" FOREIGN KEY ("center_id","organization_id") REFERENCES "electoral"."voting_centers"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_elections" ADD CONSTRAINT "center_elections_event_id_organization_id_election_events_id_organization_id_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "electoral"."election_events"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."center_elections" ADD CONSTRAINT "center_elections_district_id_canton_id_districts_id_canton_id_fk" FOREIGN KEY ("district_id","canton_id") REFERENCES "electoral"."districts"("id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."districts" ADD CONSTRAINT "districts_canton_id_cantons_id_fk" FOREIGN KEY ("canton_id") REFERENCES "electoral"."cantons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."election_events" ADD CONSTRAINT "election_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."functional_areas" ADD CONSTRAINT "functional_areas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organization_cantons" ADD CONSTRAINT "organization_cantons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organization_cantons" ADD CONSTRAINT "organization_cantons_canton_id_cantons_id_fk" FOREIGN KEY ("canton_id") REFERENCES "electoral"."cantons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organizational_positions" ADD CONSTRAINT "organizational_positions_parent_position_id_organizational_positions_id_fk" FOREIGN KEY ("parent_position_id") REFERENCES "electoral"."organizational_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organizational_positions" ADD CONSTRAINT "organizational_positions_organization_id_canton_id_organization_cantons_organization_id_canton_id_fk" FOREIGN KEY ("organization_id","canton_id") REFERENCES "electoral"."organization_cantons"("organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organizational_positions" ADD CONSTRAINT "organizational_positions_district_id_canton_id_districts_id_canton_id_fk" FOREIGN KEY ("district_id","canton_id") REFERENCES "electoral"."districts"("id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organizational_positions" ADD CONSTRAINT "organizational_positions_functional_area_id_organization_id_functional_areas_id_organization_id_fk" FOREIGN KEY ("functional_area_id","organization_id") REFERENCES "electoral"."functional_areas"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organizational_positions" ADD CONSTRAINT "organizational_positions_sectoral_movement_id_organization_id_sectoral_movements_id_organization_id_fk" FOREIGN KEY ("sectoral_movement_id","organization_id") REFERENCES "electoral"."sectoral_movements"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."organizational_positions" ADD CONSTRAINT "position_parent_scope_fk" FOREIGN KEY ("parent_position_id","organization_id","canton_id") REFERENCES "electoral"."organizational_positions"("id","organization_id","canton_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."sectoral_movements" ADD CONSTRAINT "sectoral_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electoral"."voting_centers" ADD CONSTRAINT "voting_centers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "electoral"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "official_center_code_event" ON "electoral"."center_elections" USING btree ("organization_id","event_id","tse_code") WHERE "electoral"."center_elections"."tse_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "center_scope_idx" ON "electoral"."center_elections" USING btree ("organization_id","canton_id","event_id","district_id");--> statement-breakpoint
CREATE INDEX "district_canton_idx" ON "electoral"."districts" USING btree ("canton_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_general_position" ON "electoral"."organizational_positions" USING btree ("organization_id","canton_id") WHERE "electoral"."organizational_positions"."active" AND "electoral"."organizational_positions"."kind" = 'general';--> statement-breakpoint
CREATE UNIQUE INDEX "one_district_position" ON "electoral"."organizational_positions" USING btree ("organization_id","district_id") WHERE "electoral"."organizational_positions"."active" AND "electoral"."organizational_positions"."kind" = 'district';--> statement-breakpoint
CREATE UNIQUE INDEX "one_area_position" ON "electoral"."organizational_positions" USING btree ("organization_id","canton_id","functional_area_id") WHERE "electoral"."organizational_positions"."active" AND "electoral"."organizational_positions"."kind" = 'area';