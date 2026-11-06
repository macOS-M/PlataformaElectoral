import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ configuration: vi.fn(), client: vi.fn(), user: vi.fn() }));
vi.mock("@/server/config", () => ({ getConfiguration: mocks.configuration }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.client }));
import { proxy } from "@/proxy";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configuration.mockReturnValue({ NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test" });
  mocks.client.mockReturnValue({ auth: { getUser: mocks.user } });
});

it("sirve la portada sin configurar ni contactar Auth aunque falle el proveedor", async () => {
  mocks.user.mockRejectedValue(new Error("Auth no disponible"));
  const response = await proxy(new NextRequest("http://localhost/"));
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(mocks.configuration).not.toHaveBeenCalled();
  expect(mocks.client).not.toHaveBeenCalled();
});

it("conserva la validación de sesión del proxy para rutas internas y administrativas", async () => {
  mocks.user.mockResolvedValue({ data: { user: null } });
  for (const path of ["/resumen", "/administracion/usuarios", "/iniciar-sesion"]) {
    const response = await proxy(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  }
  expect(mocks.user).toHaveBeenCalledTimes(3);
});
