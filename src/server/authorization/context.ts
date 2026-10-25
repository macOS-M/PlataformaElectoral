import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getConfiguration } from "@/server/config";
import { createAuthClient } from "@/server/auth/supabase";
import { getDb } from "@/server/db/client";
import {
  memberships,
  organizationCantons,
  organizations,
  cantons,
  electionEvents,
} from "@/server/db/schema";
import { canAccessMembership } from "./policy";
export type AccessContext = {
  userId: string;
  organizationId: string;
  cantonId: string;
  eventId: string;
  organizationName: string;
  cantonName: string;
  eventName: string;
  isDemo: boolean;
};
// React cache solo deduplica dentro de la solicitud, no comparte sesiones.
export const getAccessContext = cache(
  async (): Promise<AccessContext | null> => {
    const config = getConfiguration();
    if (!config) return null; // Vista de preparación: no se ejecutan consultas.
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) redirect("/iniciar-sesion");
    const db = getDb();
    const [member] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, data.user.id),
          eq(memberships.organizationId, config.APP_ORGANIZATION_ID),
        ),
      )
      .limit(1);
    if (!canAccessMembership(member)) redirect("/sin-acceso");
    const [scope] = await db
      .select({
        organizationName: organizations.name,
        cantonName: cantons.name,
        eventName: electionEvents.name,
        isDemo: electionEvents.isDemo,
      })
      .from(organizationCantons)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationCantons.organizationId),
      )
      .innerJoin(cantons, eq(cantons.id, organizationCantons.cantonId))
      .innerJoin(
        electionEvents,
        and(
          eq(electionEvents.organizationId, organizations.id),
          eq(electionEvents.id, config.APP_EVENT_ID),
        ),
      )
      .where(
        and(
          eq(organizationCantons.organizationId, config.APP_ORGANIZATION_ID),
          eq(organizationCantons.cantonId, config.APP_CANTON_ID),
          eq(organizationCantons.active, true),
          eq(organizations.active, true),
        ),
      )
      .limit(1);
    if (!scope) redirect("/sin-acceso");
    return {
      userId: data.user.id,
      organizationId: config.APP_ORGANIZATION_ID,
      cantonId: config.APP_CANTON_ID,
      eventId: config.APP_EVENT_ID,
      ...scope,
    };
  },
);
