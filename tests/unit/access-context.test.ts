import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  configuration: vi.fn(),
  user: vi.fn(),
  db: vi.fn(),
  select: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/server/config", () => ({ getConfiguration: mocks.configuration }));
vi.mock("@/server/auth/supabase", () => ({
  createAuthClient: async () => ({ auth: { getUser: mocks.user } }),
}));
vi.mock("@/server/db/client", () => ({ getDb: mocks.db }));
import { getAccessContext } from "@/server/authorization/context";
function query(result: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    innerJoin: () => builder,
    limit: async () => result,
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.configuration.mockReturnValue({
    APP_ORGANIZATION_ID: "org",
    APP_CANTON_ID: "canton",
    APP_EVENT_ID: "evento",
  });
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.db.mockReturnValue({ select: mocks.select });
});
describe("Acceso a datos desde servidor", () => {
  it("sin configuración no consulta Auth ni base de datos", async () => {
    mocks.configuration.mockReturnValue(null);
    expect(await getAccessContext()).toBeNull();
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("sin usuario válido redirige antes de consultar datos", async () => {
    mocks.user.mockResolvedValue({
      data: { user: null },
      error: new Error("sesión vencida"),
    });
    await expect(getAccessContext()).rejects.toThrow(
      "redirect:/iniciar-sesion",
    );
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { active: false, role: "admin" },
    { active: true, role: "reader" },
  ])("rechaza membresía ausente/inactiva/insuficiente %j", async (member) => {
    mocks.select.mockReturnValue(query(member ? [member] : []));
    await expect(getAccessContext()).rejects.toThrow("redirect:/sin-acceso");
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
  it("rechaza ámbito desactivado o no configurado", async () => {
    mocks.select
      .mockReturnValueOnce(query([{ active: true, role: "admin" }]))
      .mockReturnValueOnce(query([]));
    await expect(getAccessContext()).rejects.toThrow("redirect:/sin-acceso");
  });
  it("devuelve únicamente el ámbito del servidor tras verificar membresía", async () => {
    mocks.select
      .mockReturnValueOnce(query([{ active: true, role: "admin" }]))
      .mockReturnValueOnce(
        query([
          {
            organizationName: "Organización",
            cantonName: "Cantón",
            eventName: "Evento",
            isDemo: true,
          },
        ]),
      )
      .mockReturnValueOnce(query([]));
    expect(await getAccessContext()).toMatchObject({
      userId: "user",
      organizationId: "org",
      cantonId: "canton",
      eventId: "evento",
    });
  });
});
