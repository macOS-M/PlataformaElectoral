import { expect, test } from "@playwright/test";
test("navega entre las dos pantallas sin datos ficticios implícitos", async ({
  page,
}) => {
  await page.goto("/resumen");
  await expect(
    page.getByRole("heading", { name: "Resumen general", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tu espacio está listo para configurar."),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Organigrama", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Organigrama cantonal", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "La estructura está por comenzar" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Centros de votación" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Todavía no hay centros registrados" }),
  ).toBeVisible();
  await page.getByLabel("Buscar centro").fill("Escuela");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No encontramos coincidencias" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Limpiar", exact: true }).click();
  await expect(page.getByLabel("Buscar centro")).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("muestra acceso deshabilitado sin configuración", async ({ page }) => {
  await page.goto("/iniciar-sesion");
  await expect(
    page.getByRole("button", { name: "Ingresar al espacio" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Correo electrónico")).toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});
test("maneja filtros inválidos y páginas desconocidas", async ({ page }) => {
  await page.goto("/centros?district=incorrecto");
  await expect(
    page.getByRole("alert").filter({ hasText: "Los filtros no son válidos" }),
  ).toBeVisible();
  await page.goto("/ruta-inexistente");
  await expect(
    page.getByRole("heading", { name: "No encontramos esta página" }),
  ).toBeVisible();
});
