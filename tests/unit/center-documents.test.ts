import { describe, expect, it } from "vitest";
import { identifyDocument, responsibleSchema, MAX_DOCUMENT_BYTES } from "@/modules/voting-centers/area-schemas";
describe("Validación de adjuntos de centros", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\nPrueba");
  it("comprueba contenido además del MIME y extensión", () => {
    expect(identifyDocument(pdf, "contrato.pdf", "application/pdf")?.extension).toBe("pdf");
    expect(identifyDocument(new TextEncoder().encode("<html>"), "cedula.pdf", "application/pdf")).toBeNull();
    expect(identifyDocument(pdf, "archivo.html", "application/pdf")).toBeNull();
    expect(identifyDocument(pdf, "archivo.pdf", "text/html")).toBeNull();
    expect(identifyDocument(new Uint8Array(), "archivo.pdf", "application/pdf")).toBeNull();
    expect(identifyDocument(new Uint8Array(MAX_DOCUMENT_BYTES + 1), "archivo.pdf", "application/pdf")).toBeNull();
  });
  it("admite firmas PNG y JPEG, y rechaza imágenes disfrazadas", () => {
    expect(identifyDocument(new Uint8Array([137,80,78,71,13,10,26,10]), "cedula.png", "image/png")?.mime).toBe("image/png");
    expect(identifyDocument(new Uint8Array([255,216,255,224]), "cedula.jpg", "image/jpeg")?.mime).toBe("image/jpeg");
    expect(identifyDocument(pdf, "cedula.png", "image/png")).toBeNull();
  });
  it("valida el área, nombre y correo del encargado", () => {
    const data = { centerId: "10000000-0000-4000-8000-000000000001", areaCode: "A05", expectedId: "", personId: "", version: "", fullName: "Responsable de prueba", email: "", phone: "", notes: "", reason: "" };
    expect(responsibleSchema.safeParse(data).success).toBe(true);
    expect(responsibleSchema.safeParse({ ...data, areaCode: "district" }).success).toBe(false);
    expect(responsibleSchema.safeParse({ ...data, fullName: " " }).success).toBe(false);
    expect(responsibleSchema.safeParse({ ...data, email: "incorrecto" }).success).toBe(false);
  });
});
