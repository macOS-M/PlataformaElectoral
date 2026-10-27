import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  scope: vi.fn(),
  rate: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  create: vi.fn(),
  authorize: vi.fn(),
  change: vi.fn(),
  lookup: vi.fn(),
  lookupEnabled: vi.fn(),
  target: vi.fn(),
  saveName: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/access/name-lookup", () => ({
  lookupUserName: m.lookup,
  nameLookupConfigured: m.lookupEnabled,
}));
vi.mock("@/server/authorization/context", () => ({
  getAccessContext: m.scope,
}));
vi.mock("@/server/config", () => ({
  getConfiguration: () => ({
    APP_ORGANIZATION_ID: "10000000-0000-4000-8000-000000000001",
  }),
}));
vi.mock("@/server/auth/admin", () => ({
  createAdminAuthClient: () => ({ auth: { admin: { createUser: m.create } } }),
}));
vi.mock("@/modules/access/identity", () => ({
  identifierHash: (v: string) => v,
  activationHash: (v: string) => v,
  activationCode: () => "activation-for-test",
  registrationConfigured: () => true,
}));
vi.mock("@/modules/access/repository", () => ({
  checkRate: m.rate,
  claimRegistration: m.claim,
  releaseRegistration: m.release,
  authorize: m.authorize,
  changeAccess: m.change,
  nameRefreshTarget: m.target,
  saveRefreshedName: m.saveName,
}));
import {
  registerAuthorized,
  authorizeCedula,
  updateAccess,
  refreshUserName,
} from "@/modules/access/service";
const data = {
  fullName: "Usuario sintético",
  cedula: "100000000",
  code: "test-activation",
  password: "Contraseña de prueba 123",
  confirmPassword: "Contraseña de prueba 123",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.scope.mockResolvedValue({
    userId: "actor",
    role: "member",
    editableModules: ["district"],
  });
  m.rate.mockResolvedValue(true);
  m.lookupEnabled.mockReturnValue(true);
  m.lookup.mockResolvedValue("Nombre consultado de prueba");
  m.claim.mockResolvedValue("90000000-0000-4000-8000-000000000001");
  m.create.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
});
describe("Registro controlado desde el servidor", () => {
  it("permite nombre manual sin consultas externas cuando la integración está apagada", async () => {
    m.lookupEnabled.mockReturnValue(false);
    await registerAuthorized(data);
    expect(m.lookup).not.toHaveBeenCalled();
    expect(m.create.mock.calls[0][0].user_metadata).toEqual({
      full_name: data.fullName,
      name_source: "manual",
    });
  });
  it("un coordinador distrital no puede autorizar cédulas ni modificar accesos", async () => {
    await expect(authorizeCedula({})).rejects.toThrow();
    await expect(updateAccess({})).rejects.toThrow();
    expect(m.authorize).not.toHaveBeenCalled();
    expect(m.change).not.toHaveBeenCalled();
  });
  it("no crea usuarios si el código no autoriza o se excede el límite", async () => {
    m.claim.mockResolvedValue(null);
    await expect(registerAuthorized(data)).rejects.toThrow();
    expect(m.create).not.toHaveBeenCalled();
    expect(m.lookup).not.toHaveBeenCalled();
    m.rate.mockResolvedValue(false);
    m.claim.mockClear();
    await expect(registerAuthorized(data)).rejects.toThrow();
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("la cuenta usa un alias interno y no acepta rol ni módulos del registro público", async () => {
    await registerAuthorized({ ...data, role: "admin", modules: ["district"] });
    const input = m.create.mock.calls[0][0];
    expect(input.email).toBe(
      "90000000-0000-4000-8000-000000000001@accounts.cantonal.invalid",
    );
    expect(input.user_metadata.full_name).toBe("Nombre consultado de prueba");
    expect(input.user_metadata.name_source).toBe("soportereal");
    expect(input).not.toHaveProperty("role");
    expect(input.app_metadata).not.toHaveProperty("role");
    expect(input.app_metadata).not.toHaveProperty("modules");
  });
  it("libera la reserva ante fallo del proveedor sin consumir el código", async () => {
    m.create.mockResolvedValue({
      data: { user: null },
      error: { status: 500 },
    });
    await expect(registerAuthorized(data)).rejects.toThrow();
    expect(m.release).toHaveBeenCalledOnce();
  });
  it("libera el código y no crea una cuenta si falla la consulta de nombre", async () => {
    m.lookup.mockRejectedValueOnce(new Error("No disponible"));
    await expect(registerAuthorized(data)).rejects.toThrow();
    expect(m.create).not.toHaveBeenCalled();
    expect(m.release).toHaveBeenCalledOnce();
  });
  it("comprueba la cédula de la cuenta antes de enviar una consulta administrativa", async () => {
    m.scope.mockResolvedValue({ userId: "admin", role: "admin" });
    m.target.mockRejectedValueOnce(new Error("No corresponde"));
    await expect(
      refreshUserName({
        id: "90000000-0000-4000-8000-000000000001",
        cedula: data.cedula,
      }),
    ).rejects.toThrow();
    expect(m.lookup).not.toHaveBeenCalled();
    expect(m.saveName).not.toHaveBeenCalled();
  });
  it("rechaza contraseñas distintas antes de contactar Auth", async () => {
    await expect(
      registerAuthorized({ ...data, confirmPassword: "Otra contraseña" }),
    ).rejects.toThrow();
    expect(m.create).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled();
  });
});
