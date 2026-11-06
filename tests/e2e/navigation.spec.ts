import { expect, test } from "@playwright/test";
test("la portada pública informa disponibilidad y mantiene separado el acceso interno", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Los servicios de tu cantón y distrito" })).toBeVisible();
  const officialLink = page.getByRole("link", { name: "Consultar dónde votar en el TSE" });
  await expect(officialLink).toHaveAttribute("href", "https://www.tse.go.cr/DondeVotar/");
  await expect(officialLink).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByLabel("Cantón", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Distrito", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ver servicios disponibles" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("El catálogo de cantones y distritos no está disponible");
  await expect(page.getByRole("heading", { name: /^Servicios en/ })).toHaveCount(0);
  for (const size of [{ width: 1366, height: 768 }, { width: 393, height: 851 }, { width: 360, height: 740 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Ver servicios disponibles" })).toBeVisible();
  }
  await page.route("https://www.tse.go.cr/DondeVotar/", (route) => route.fulfill({
    contentType: "text/html",
    body: "<html lang='es'><title>Destino externo simulado</title><body>Destino externo simulado</body></html>",
  }));
  await officialLink.click();
  await expect(page).toHaveURL("https://www.tse.go.cr/DondeVotar/");
  await page.goto("/");
  await page.screenshot({ path: testInfo.outputPath("portada.png"), fullPage: true });
  await page.getByRole("link", { name: "Acceso interno" }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page.getByRole("heading", { name: "Los servicios de tu cantón y distrito" })).toBeVisible();
  await page.goto("/administracion/usuarios");
  await expect(page).toHaveURL(/\/sin-acceso$/);
  await expect(page.getByRole("heading", { name: "Usuarios y accesos" })).toHaveCount(0);
});

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

test("transporte y capacitación sin conexión no ofrecen mutaciones", async ({ page }) => {
  await page.goto("/transporte");
  await expect(page.getByRole("heading", { name: "Transporte", exact: true })).toBeVisible();
  await expect(page.getByText("No hay vehículos registrados.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar vehículo" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Capacitación", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Capacitación por puesto" })).toBeVisible();
  await expect(page.getByText("No hay puestos disponibles.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar requisito" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("recuperación sin configuración no envía correos ni acepta contraseñas", async ({ page }) => {
  await page.goto("/iniciar-sesion");
  await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar acceso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar enlace de recuperación" })).toBeDisabled();
  await page.goto("/restablecer-contrasena");
  await expect(page.getByRole("button", { name: "Guardar nueva contraseña" })).toHaveCount(0);
});
