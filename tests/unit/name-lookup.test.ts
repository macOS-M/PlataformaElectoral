import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { lookupUserName } from "@/modules/access/name-lookup";
const fetchMock = vi.fn();
const identifier = "100000000"; // Identificador sintético, nunca se consulta en el proveedor real.
const valid = {
  identificacion: identifier,
  tipoIdentificacion: "01",
  nombre: " PERSONA   SINTÉTICA ",
  domicilio: { distrito: "DESCARTAR" },
  situacion: { moroso: "DESCARTAR" },
};
beforeEach(() => {
  vi.stubEnv("SOPORTEREAL_ENABLED", "true");
  vi.stubEnv("SOPORTEREAL_API_KEY", "test-token");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Consulta de nombres de Soporte Real", () => {
  it("consulta con token solo por HTTPS y devuelve exclusivamente el nombre", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(valid), { status: 200 }),
    );
    expect(await lookupUserName("1-0000-0000")).toBe("PERSONA SINTÉTICA");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.origin).toBe("https://soportereal.com");
    expect(url.searchParams.get("identificacion")).toBe(identifier);
    expect(url.searchParams.has("token")).toBe(false);
    expect(options.headers["X-Api-Key"]).toBe("test-token");
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
  });
  it("no consulta cuando la integración está apagada, aunque exista un token", async () => {
    vi.stubEnv("SOPORTEREAL_ENABLED", "false");
    await expect(lookupUserName(identifier)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("no envía solicitudes sin token o con identificación inválida", async () => {
    await expect(lookupUserName("invalid")).rejects.toThrow();
    vi.stubEnv("SOPORTEREAL_API_KEY", "");
    await expect(lookupUserName(identifier)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 404, 429, 503])(
    "maneja HTTP %s sin filtrar datos o tokens en el error",
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response("private upstream detail", { status }),
      );
      await expect(lookupUserName(identifier)).rejects.toThrow(
        "No se pudo obtener el nombre de Soporte Real. Inténtalo más tarde.",
      );
    },
  );
  it.each([
    { ...valid, identificacion: "200000000" },
    { ...valid, tipoIdentificacion: "02" },
    { ...valid, nombre: "" },
    { ...valid, nombre: "x".repeat(161) },
    { ...valid, nombre: "A\u0000B" },
  ])(
    "rechaza respuestas que no identifican a la persona solicitada",
    async (response) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );
      await expect(lookupUserName(identifier)).rejects.toThrow();
    },
  );
  it("maneja interrupciones y respuestas no JSON", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    await expect(lookupUserName(identifier)).rejects.toThrow();
    fetchMock.mockResolvedValue(new Response("not-json", { status: 200 }));
    await expect(lookupUserName(identifier)).rejects.toThrow();
  });
});
