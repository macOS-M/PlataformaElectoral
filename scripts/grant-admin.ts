import { z } from "zod";
import { administrativeDatabase } from "./database";
async function main() {
  const userId = z.uuid().parse(process.argv[2]);
  const organizationId = z.uuid().parse(process.env.APP_ORGANIZATION_ID);
  const { client } = administrativeDatabase();
  try {
    await client.begin(async (tx) => {
      const users = await tx`select id from auth.users where id = ${userId}`;
      if (!users.length) throw new Error("Usuario inexistente");
      await tx`insert into electoral.organization_memberships (organization_id, user_id, role, active) values (${organizationId}, ${userId}, 'admin', true) on conflict (organization_id, user_id) do update set role='admin', active=true`;
      // Operación administrativa CLI: no atribuir la ejecución a la cuenta beneficiaria.
      await tx`insert into electoral.audit_logs (organization_id, actor_user_id, entity, entity_id, action) values (${organizationId}, null, 'organization_memberships', ${userId}, 'admin_granted_cli')`;
    });
    console.log("Membresía administrativa habilitada y registrada.");
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "No se pudo habilitar acceso. Usa npm run db:grant-admin -- UUID_USUARIO y revisa organización, usuario y conexión.",
  );
  process.exitCode = 1;
});
