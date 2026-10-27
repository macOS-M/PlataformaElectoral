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
test("muestra acceso deshabilitado sin configuración", async ({
  page,
}, testInfo) => {
  await page.goto("/iniciar-sesion");
  await expect(
    page.getByRole("button", { name: "Ingresar al espacio" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Cédula o correo")).toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.screenshot({
    path: testInfo.outputPath("login.png"),
    fullPage: true,
  });
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

test("registro autorizado sin configuración no permite enviar contraseñas", async ({
  page,
}) => {
  await page.goto("/registrarse");
  await expect(
    page.getByRole("heading", { name: "Crear mi cuenta" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toBeDisabled();
  await expect(page.getByLabel("Código de activación")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Crear mi cuenta" }),
  ).toBeDisabled();
});

test("el alta de centros requiere administración y no se ofrece sin sesión", async ({ page }) => {
  await page.goto("/centros/nuevo");
  await expect(page).toHaveURL(/\/centros$/);
  await expect(page.getByRole("link", { name: "Agregar centro" })).toHaveCount(0);
});

test("no expone fichas, áreas ni documentos sin un ámbito autorizado", async ({ page }) => {
  const id = "10000000-0000-4000-8000-000000000001";
  for (const path of [`/centros/${id}`, `/centros/${id}/areas/A05`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar encargado" })).toHaveCount(0);
  }
  const document = await page.request.get(`/centros/${id}/areas/A05/documentos/${id}`);
  expect(document.status()).toBe(404);
});
