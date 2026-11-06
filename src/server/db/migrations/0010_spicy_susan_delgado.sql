ALTER TABLE "electoral"."training_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."training_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_center_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."vehicle_district_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electoral"."vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "training_progress_server_read" ON "electoral"."training_progress" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "training_requirements_server_read" ON "electoral"."training_requirements" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "vehicle_centers_server_read" ON "electoral"."vehicle_center_assignments" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "vehicle_districts_server_read" ON "electoral"."vehicle_district_assignments" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);--> statement-breakpoint
CREATE POLICY "vehicles_server_read" ON "electoral"."vehicles" AS PERMISSIVE FOR SELECT TO "electoral_app" USING (true);