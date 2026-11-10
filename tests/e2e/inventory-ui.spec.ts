import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
let script:string,styles:string;
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:[resolve("tests/fixtures/inventory-ui.tsx")],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",plugins:[{name:"inventory-action-double",setup(builder){builder.onLoad({filter:/[\\/]inventory[\\/]actions\.ts$/},()=>({contents:'export async function inventoryAction(_state,form){return window.__inventoryUiSave(form)}',loader:"js"}));}}]});
 script=bundle.outputFiles[0].text;
 const files=await readdir(".next/static/chunks");
 styles=(await Promise.all(files.filter(f=>f.endsWith(".css")).map(f=>readFile(resolve(".next/static/chunks",f),"utf8")))).join("\n").replaceAll("../media/","/_next/static/media/");
});
async function open(page:import("@playwright/test").Page,empty=false,many=false){
 await page.route("**/__inventory-ui-test*",route=>route.fulfill({contentType:"text/html; charset=utf-8",body:'<!doctype html><html lang="es" style="--font-poppins:poppins"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root" class="mx-auto max-w-6xl p-4 sm:p-6"></main></body></html>'}));
 await page.goto(`/__inventory-ui-test${empty?"?empty=1":many?"?many=1":""}`);await page.addStyleTag({content:styles});await page.addScriptTag({content:script});
 await expect(page.getByRole("button",{name:"Nuevo artículo",exact:true})).toBeVisible();
}

test("restar permite elegir el motivo y confirmar un consumo con artículo y saldo",async({page})=>{
 await open(page);
 const card=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Banderín",exact:true})});
 await card.getByRole("button",{name:"Restar",exact:true}).click();
 await expect(page.getByRole("dialog").getByText("Descuenta existencias cuando otro administrador aprueba la pérdida.")).toBeVisible();
 await page.getByRole("dialog").getByRole("button",{name:/^Registrar consumo/}).click();
 const dialog=page.getByRole("dialog");
 await expect(dialog.getByRole("heading",{name:"Registrar consumo",exact:true})).toBeVisible();
 await expect(dialog.getByLabel("¿De dónde sale?")).toHaveValue("20000000-0000-4000-8000-000000000001");
 await expect(dialog.getByRole("status")).toContainText("15");
 await dialog.getByLabel("Cantidad (pieza)").fill("2");
 await dialog.getByLabel("Motivo",{exact:true}).fill("Consumo de prueba");
 await dialog.getByRole("button",{name:"Revisar movimiento"}).click();
 expect((await submissions(page)).filter(s=>s.operation==="movement")).toHaveLength(0);
 await expect(dialog.getByText("Disponible en origen: 15 → 13 pieza",{exact:true})).toBeVisible();
 await dialog.getByRole("button",{name:"Confirmar movimiento"}).click();
 await expect(page.getByRole("dialog")).toHaveCount(0);
 const posted=(await submissions(page)).at(-1);
 expect(posted?.kind).toBe("consumo");expect(posted?.quantity).toBe("2");
 expect(posted?.itemId).toBe("10000000-0000-4000-8000-000000000001");
});
async function submissions(page:import("@playwright/test").Page){return page.evaluate(()=>(window as unknown as {__inventoryUiSubmissions:Record<string,string>[]}).__inventoryUiSubmissions);}

test("adjunta comprobantes al movimiento y los conserva al revisar y ante rechazo",async({page},info)=>{
 await open(page);const article=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Banderín",exact:true})});await article.getByRole("button",{name:"Restar",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:/^Registrar consumo/}).click();const dialog=page.getByRole("dialog");
 await dialog.getByLabel("Cantidad (pieza)").fill("2");await dialog.getByLabel("Motivo",{exact:true}).fill("error de prueba");await dialog.locator("summary").filter({hasText:"Fecha y comprobante"}).click();
 await dialog.getByLabel("Adjuntar comprobantes (opcional)").setInputFiles([{name:"recibo-sintetico.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\nComprobante sintético")},{name:"foto-sintetica.png",mimeType:"image/png",buffer:Buffer.from([137,80,78,71,13,10,26,10])}]);
 await dialog.getByRole("button",{name:"Revisar movimiento",exact:true}).click();await expect(dialog.getByText("recibo-sintetico.pdf · 1 KB",{exact:true})).toBeVisible();await expect(dialog.getByText("foto-sintetica.png · 1 KB",{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath("comprobantes-inventario.png"),fullPage:true});
 await dialog.getByRole("button",{name:"Confirmar movimiento",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("datos se conservan");await dialog.getByRole("button",{name:"Volver a los datos",exact:true}).click();expect(await dialog.getByLabel("Adjuntar comprobantes (opcional)").evaluate((input:HTMLInputElement)=>input.files?.length)).toBe(2);
 await dialog.getByLabel("Motivo",{exact:true}).fill("Consumo con comprobante sintético");await dialog.getByRole("button",{name:"Revisar movimiento",exact:true}).click();await dialog.getByRole("button",{name:"Confirmar movimiento",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);expect(JSON.parse((await submissions(page)).at(-1)!.attachmentNames)).toEqual(["recibo-sintetico.pdf","foto-sintetica.png"]);
});

test("el formulario limita cantidad y tamaño total antes de la revisión",async({page})=>{
 await open(page);const article=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Banderín",exact:true})});await article.getByRole("button",{name:"Restar",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:/^Registrar consumo/}).click();const dialog=page.getByRole("dialog");await dialog.locator("summary").filter({hasText:"Fecha y comprobante"}).click();const input=dialog.getByLabel("Adjuntar comprobantes (opcional)");
 await input.setInputFiles(Array.from({length:4},(_,index)=>({name:`prueba-${index}.pdf`,mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7")})));expect(await input.evaluate((element:HTMLInputElement)=>element.validity.customError)).toBe(true);
 await input.setInputFiles({name:"grande.pdf",mimeType:"application/pdf",buffer:Buffer.alloc(5242881)});expect(await input.evaluate((element:HTMLInputElement)=>element.validity.customError)).toBe(true);
 await input.setInputFiles({name:"valido.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7")});expect(await input.evaluate((element:HTMLInputElement)=>element.validity.customError)).toBe(false);expect(await submissions(page)).toHaveLength(0);
});

test("catálogo grande pagina, busca en todos los productos y abre detalle contextual",async({page},info)=>{
 await open(page,false,true);
 const nav=page.getByRole("navigation",{name:"Páginas del catálogo"});
 await expect(page.getByRole("article")).toHaveCount(25);
 await expect(nav).toContainText("Página 1 de 9");
 await page.screenshot({path:info.outputPath("inventario-lista-compacta.png")});
 await nav.getByRole("button",{name:"Siguiente",exact:true}).click();
 await expect(nav).toContainText("Página 2 de 9");
 await expect(page.getByRole("region",{name:"Catálogo de artículos"})).toBeFocused();
 await page.getByRole("searchbox",{name:"Buscar artículos"}).fill("Material de prueba 200");
 await expect(page.getByRole("article")).toHaveCount(1);
 await expect(nav).toContainText("Página 1 de 1");
 await page.getByRole("button",{name:"Ver detalle y ubicaciones",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Detalle del artículo"});
 await expect(dialog.getByRole("heading",{name:"Material de prueba 200",exact:true})).toBeVisible();
 await expect(dialog.getByText("Almacén central",{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath("inventario-detalle.png")});
 await dialog.getByRole("button",{name:"Restar aquí",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:/^Registrar consumo/}).click();
 await expect(page.getByRole("dialog").getByRole("combobox",{name:"Artículo",exact:true})).toHaveValue("10000000-0000-4000-8000-000000001200");
 await expect(page.getByRole("dialog").getByLabel("¿De dónde sale?")).toHaveValue("20000000-0000-4000-8000-000000000001");
 await page.keyboard.press("Escape");
 await page.getByRole("button",{name:"Limpiar filtros",exact:true}).click();
 await page.getByRole("combobox",{name:"Categoría",exact:true}).selectOption("Pruebas B");
 await expect(nav).toContainText("Página 1 de 4");
 await page.getByRole("combobox",{name:"Existencias",exact:true}).selectOption("damaged");
 await expect(page.getByRole("article")).toHaveCount(10);
 await page.getByRole("combobox",{name:"Ordenar artículos",exact:true}).selectOption("reverse");
 await expect(page.getByRole("article").first()).toContainText("Material de prueba 200");
 await page.getByRole("button",{name:"Limpiar filtros",exact:true}).click();
 await nav.getByRole("combobox",{name:"Artículos por página",exact:true}).selectOption("10");
 await expect(page.getByRole("article")).toHaveCount(10);
 await expect(nav).toContainText("Página 1 de 21");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await submissions(page)).toHaveLength(0);
});

test("catálogo con búsqueda, inactivos y foco del diálogo",async({page},info)=>{
 await open(page);
 await expect(page.getByRole("article")).toHaveCount(1);
 await page.getByRole("searchbox",{name:"Buscar artículos"}).fill("banderin");await expect(page.getByRole("article")).toHaveCount(1);
 await page.getByRole("searchbox").fill("camiseta");await expect(page.getByRole("article")).toHaveCount(0);
 await page.getByRole("checkbox",{name:"Solo activos"}).uncheck();await expect(page.getByRole("article")).toHaveCount(1);
 await page.getByRole("searchbox").fill("");
 const trigger=page.getByRole("button",{name:"Nuevo artículo",exact:true});await trigger.click();await expect(page.getByRole("dialog",{name:"Nuevo artículo"})).toBeVisible();
 await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);await expect(trigger).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath("inventario-catalogo.png"),fullPage:true});
});

test("crear artículo continúa con ingreso preseleccionado y confirmación",async({page},info)=>{
 await open(page);await page.getByRole("button",{name:"Nuevo artículo",exact:true}).click();
 const dialog=page.getByRole("dialog");await dialog.getByLabel("Nombre",{exact:true}).fill("Gorra de prueba");await dialog.getByLabel("Variante").fill("Blanca");await dialog.getByLabel("Categoría").fill("Ropa");
 await dialog.getByRole("button",{name:"Crear artículo",exact:true}).click();await dialog.getByRole("button",{name:"Sumar existencias de este artículo"}).click();
 await expect(dialog.getByRole("combobox",{name:"Artículo",exact:true})).not.toHaveValue("");await expect(dialog.getByLabel("¿En qué almacén lo recibís?")).not.toHaveValue("");
 await dialog.getByLabel("Cantidad (pieza)").fill("8");await dialog.getByLabel("¿De dónde viene el material?").fill("Donación de prueba");await dialog.getByLabel("Motivo",{exact:true}).fill("Recepción de prueba");
 await dialog.getByRole("button",{name:"Revisar movimiento"}).click();await expect(dialog.getByText("Revisá antes de guardar")).toBeVisible();expect((await submissions(page)).filter(s=>s.operation==="movement")).toHaveLength(0);
 await dialog.getByRole("button",{name:"Volver a los datos"}).click();await expect(dialog.getByLabel("Cantidad (pieza)")).toHaveValue("8");
 await dialog.getByRole("button",{name:"Revisar movimiento"}).click();await page.screenshot({path:info.outputPath("inventario-confirmacion.png"),fullPage:true});
 await dialog.getByRole("button",{name:"Confirmar movimiento"}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
 const posted=(await submissions(page)).find(s=>s.operation==="movement");expect(posted?.quantity).toBe("8");expect(posted?.kind).toBe("ingreso");expect(posted?.destinationId).toBe("20000000-0000-4000-8000-000000000001");
 await expect(page.getByRole("article").filter({has:page.getByRole("heading",{name:"Gorra de prueba"})})).toContainText("8");
});

test("entrega muestra saldo, limita cantidad y conserva datos tras rechazo",async({page},info)=>{
 await open(page);await page.getByRole("article").getByRole("button",{name:"Entregar",exact:true}).click();const dialog=page.getByRole("dialog");
 await expect(dialog.getByRole("status")).toContainText("15");await dialog.getByLabel("¿Dónde lo entregás?").selectOption("20000000-0000-4000-8000-000000000002");
 const quantity=dialog.getByLabel("Cantidad (pieza)");await quantity.fill("16");expect(await quantity.evaluate(e=>(e as HTMLInputElement).validity.rangeOverflow)).toBe(true);
 await quantity.fill("4");await dialog.getByLabel("Motivo",{exact:true}).fill("error de prueba");await dialog.getByRole("button",{name:"Revisar movimiento"}).click();await dialog.getByRole("button",{name:"Confirmar movimiento"}).click();
 await expect(dialog.getByRole("alert")).toContainText("Los datos se conservan");await dialog.getByRole("button",{name:"Volver a los datos"}).click();await expect(quantity).toHaveValue("4");await expect(dialog.getByLabel("Motivo",{exact:true})).toHaveValue("error de prueba");
 await dialog.getByLabel("Motivo",{exact:true}).fill("Entrega de prueba");await page.screenshot({path:info.outputPath("inventario-entrega.png"),fullPage:true});await dialog.getByRole("button",{name:"Revisar movimiento"}).click();await dialog.getByRole("button",{name:"Confirmar movimiento"}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
 const posted=(await submissions(page)).at(-1);expect(posted?.kind).toBe("transferencia");expect(posted?.sourceId).toBe("20000000-0000-4000-8000-000000000001");expect(posted?.quantity).toBe("4");expect(posted?.requestId).toMatch(/^[0-9a-f-]{36}$/);
});

test("estado vacío guía primero al artículo y luego al almacén",async({page})=>{
 await open(page,true);await expect(page.getByText("Tu inventario empieza aquí")).toBeVisible();await expect(page.getByRole("button",{name:"Registrar movimiento",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Crear primer artículo"}).click();const dialog=page.getByRole("dialog");await dialog.getByLabel("Nombre",{exact:true}).fill("Artículo inicial");await dialog.getByLabel("Categoría").fill("Materiales");await dialog.getByRole("button",{name:"Crear artículo",exact:true}).click();
 await dialog.getByRole("button",{name:"Crear un almacén",exact:true}).click();await dialog.getByLabel("Nombre del almacén").fill("Almacén inicial");await dialog.getByRole("button",{name:"Crear ubicación",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("article").getByRole("button",{name:"Sumar",exact:true})).toBeEnabled();
});

test("centro vacío explica la recepción y preselecciona el destino de transferencia",async({page},info)=>{
 await open(page);await page.getByRole("button",{name:"Ubicaciones",exact:true}).click();
 const center=page.getByRole("article",{name:"Escuela de prueba",exact:true});
 await expect(center.getByText("Sin materiales en esta ubicación")).toBeVisible();
 await expect(center.getByText("0 artículos con existencias")).toBeVisible();
 await page.screenshot({path:info.outputPath("ubicaciones.png"),fullPage:true});
 await center.getByRole("button",{name:"Recibir desde otra ubicación"}).click();
 const dialog=page.getByRole("dialog");await expect(dialog.getByLabel("¿Dónde lo entregás?")).toHaveValue("20000000-0000-4000-8000-000000000002");
 await expect(dialog.getByLabel("¿De dónde sale?")).toHaveValue("20000000-0000-4000-8000-000000000001");
 await dialog.getByLabel("Cantidad (pieza)").fill("3");await dialog.getByLabel("Motivo",{exact:true}).fill("Entrega al centro de prueba");
 await dialog.getByRole("button",{name:"Revisar movimiento"}).click();await dialog.getByRole("button",{name:"Confirmar movimiento"}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
 const posted=(await submissions(page)).at(-1);expect(posted?.kind).toBe("transferencia");expect(posted?.destinationId).toBe("20000000-0000-4000-8000-000000000002");expect(posted?.sourceId).not.toBe(posted?.destinationId);
});
