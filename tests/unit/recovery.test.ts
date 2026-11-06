import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn(), scope: vi.fn(), rate: vi.fn(), reset: vi.fn(), update: vi.fn(), signOut: vi.fn(), auth: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({ getConfiguration: mocks.config }));
vi.mock("@/server/authorization/context", () => ({ getAccessContext: mocks.scope }));
vi.mock("@/modules/access/identity", () => ({ identifierHash: (value: string) => `opaque:${value.length}` }));
vi.mock("@/modules/access/repository", () => ({ checkRate: mocks.rate }));
vi.mock("@/server/auth/supabase", () => ({ createAuthClient: mocks.auth }));
import { recoveryOrigin, recoveryConfigured, requestPasswordRecovery, replaceRecoveredPassword } from "@/modules/auth/recovery";
const passwords = { password: "synthetic-password-2026", confirmation: "synthetic-password-2026" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_SITE_URL", "http://127.0.0.1:3000"); vi.stubEnv("AUTH_IDENTIFIER_SECRET", "s".repeat(32));
  mocks.config.mockReturnValue({}); mocks.scope.mockResolvedValue({ userId: "verified-user" }); mocks.rate.mockResolvedValue(true);
  mocks.reset.mockResolvedValue({ error: null }); mocks.update.mockResolvedValue({ error: null }); mocks.signOut.mockResolvedValue({ error: null });
  mocks.auth.mockResolvedValue({ auth: { resetPasswordForEmail: mocks.reset, updateUser: mocks.update, signOut: mocks.signOut } });
});
afterEach(() => vi.unstubAllEnvs());
describe("Recuperación por correo sin panel administrativo", () => {
  it.each(["http://remote.example", "https://example.com/path", "https://example.com/?next=evil", "https://user:secret@example.com", "javascript:alert(1)"])("rechaza origen inseguro o ambiguo %s", origin => {
    vi.stubEnv("APP_SITE_URL", origin); expect(recoveryOrigin()).toBeNull(); expect(recoveryConfigured()).toBe(false);
  });
  it("usa origen configurado y callback fijo con correo normalizado", async () => {
    await requestPasswordRecovery(" Citizen@Example.invalid ");
    expect(mocks.reset).toHaveBeenCalledWith("citizen@example.invalid", { redirectTo: "http://127.0.0.1:3000/auth/callback" });
    expect(mocks.scope).not.toHaveBeenCalled();
  });
  it("no envía si falta configuración, correo inválido o alias técnico", async () => {
    await expect(requestPasswordRecovery("invalid")).rejects.toThrow();
    await expect(requestPasswordRecovery("test@accounts.cantonal.invalid")).rejects.toThrow();
    mocks.config.mockReturnValue(null);
    await expect(requestPasswordRecovery("citizen@example.invalid")).rejects.toThrow();
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it("limita envíos sin distinguir cuentas existentes", async () => {
    mocks.rate.mockResolvedValueOnce(false);
    await requestPasswordRecovery("citizen@example.invalid");
    expect(mocks.reset).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await requestPasswordRecovery("other@example.invalid");
    expect(mocks.reset).not.toHaveBeenCalled();
  });
  it("no reporta envío correcto si falla el proveedor", async () => {
    mocks.reset.mockResolvedValue({ error: new Error("SMTP failure") });
    await expect(requestPasswordRecovery("citizen@example.invalid")).rejects.toThrow("Recuperación no disponible");
  });
});
describe("Cambio de contraseña para identidad verificada", () => {
  it("rechaza ausencia/revocación de sesión antes de actualizar", async () => {
    mocks.scope.mockResolvedValue(null);
    await expect(replaceRecoveredPassword(passwords)).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.scope.mockRejectedValue(new Error("redirect:/sin-acceso"));
    await expect(replaceRecoveredPassword(passwords)).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("valida longitud y coincidencia sin actualizar Auth", async () => {
    await expect(replaceRecoveredPassword({ password: "short", confirmation: "short" })).rejects.toThrow();
    await expect(replaceRecoveredPassword({ ...passwords, confirmation: "different-password" })).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("cambia solo la contraseña de la sesión y solicita cierre global", async () => {
    expect(await replaceRecoveredPassword({ ...passwords, userId: "other-user" })).toEqual({ signedOut: true });
    expect(mocks.update).toHaveBeenCalledWith({ password: passwords.password });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("distingue fallo de cambio y fallo de cierre posterior", async () => {
    mocks.update.mockResolvedValueOnce({ error: new Error("rejected") });
    await expect(replaceRecoveredPassword(passwords)).rejects.toThrow(); expect(mocks.signOut).not.toHaveBeenCalled();
    mocks.signOut.mockResolvedValueOnce({ error: new Error("unavailable") });
    expect(await replaceRecoveredPassword(passwords)).toEqual({ signedOut: false });
  });
});
