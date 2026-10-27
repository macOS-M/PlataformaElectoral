import "server-only";
import { lookupUserName, nameLookupConfigured } from "./name-lookup";
import { refreshNameSchema } from "./schemas";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getAccessContext } from "@/server/authorization/context";
import { isGlobalAdmin } from "@/server/authorization/policy";
import { getConfiguration } from "@/server/config";
import { createAdminAuthClient } from "@/server/auth/admin";
import {
  identifierHash,
  activationHash,
  activationCode,
  registrationConfigured,
} from "./identity";
import {
  authorizationSchema,
  accessSchema,
  registrationSchema,
} from "./schemas";
import * as repository from "./repository";
export async function requireAdmin() {
  const scope = await getAccessContext();
  if (!scope || !isGlobalAdmin(scope)) throw new Error("Acceso denegado");
  return scope;
}
export async function getAccessAdministration() {
  return repository.readAccess(await requireAdmin());
}
export async function authorizeCedula(input: unknown) {
  const scope = await requireAdmin();
  const data = authorizationSchema.parse(input);
  const code = activationCode();
  await repository.authorize(scope, {
    hash: identifierHash(data.cedula),
    hint: data.cedula.slice(-4),
    activation: code ? activationHash(code) : null,
    role: data.role,
    modules: data.modules,
  });
  return code;
}
export async function updateAccess(input: unknown) {
  const scope = await requireAdmin();
  return repository.changeAccess(scope, accessSchema.parse(input));
}
export async function registrationRate(hash: string) {
  // Límites global y por identificador compartidos entre instancias, sin registrar IPs o cédulas.
  return (
    (await repository.checkRate(
      identifierHash("registration-global"),
      60,
      60,
    )) &&
    (await repository.checkRate(identifierHash("registration:" + hash), 6, 900))
  );
}
export async function registerAuthorized(input: unknown) {
  const config = getConfiguration();
  if (!config || !registrationConfigured())
    throw new Error("Registro sin configurar");
  const data = registrationSchema.parse(input);
  const automaticName = nameLookupConfigured();
  if (!automaticName && data.fullName.length < 2)
    throw new Error("Escribe tu nombre completo");
  const hash = identifierHash(data.cedula);
  if (!(await registrationRate(hash)))
    throw new Error("Registro no disponible");
  const token = randomUUID();
  const id = await repository.claimRegistration(
    hash,
    activationHash(data.code),
    config.APP_ORGANIZATION_ID,
    token,
  );
  if (!id) throw new Error("Registro no disponible");
  try {
    const fullName = automaticName
      ? await lookupUserName(data.cedula)
      : data.fullName;
    const client = createAdminAuthClient();
    const { data: created, error } = await client.auth.admin.createUser({
      email: id + "@accounts.cantonal.invalid",
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        name_source: automaticName ? "soportereal" : "manual",
        ...(automaticName
          ? { name_consulted_at: new Date().toISOString() }
          : {}),
      },
      app_metadata: { electoral_invitation: id, electoral_claim: token },
    });
    if (error || !created.user) throw new Error("Registro no disponible");
  } catch {
    await repository.releaseRegistration(id, token);
    throw new Error("Registro no disponible");
  }
}

export async function renewActivation(input: unknown) {
  const scope = await requireAdmin();
  const id = z.uuid().parse(input);
  const code = activationCode();
  await repository.renewActivation(scope, id, activationHash(code));
  return code;
}

export async function refreshUserName(input: unknown) {
  const scope = await requireAdmin();
  if (!nameLookupConfigured()) throw new Error("Consulta externa desactivada");
  const data = refreshNameSchema.parse(input);
  const hash = identifierHash(data.cedula);
  // Comprueba que la cédula corresponda a esta autorización antes de enviarla al proveedor.
  await repository.nameRefreshTarget(scope, data.id, hash);
  if (
    !(await repository.checkRate(
      identifierHash("name-admin:" + scope.userId),
      20,
      60,
    ))
  )
    throw new Error("Espera antes de consultar otra vez");
  const name = await lookupUserName(data.cedula);
  await repository.saveRefreshedName(scope, data.id, hash, name);
  return name;
}
