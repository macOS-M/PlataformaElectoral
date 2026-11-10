import { expect,test } from "@playwright/test";
import { build } from "esbuild";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
let script:string,styles:string;
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:[resolve("tests/fixtures/public-transport-ui.tsx")],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",plugins:[{name:"transport-fixture-only",setup(b){
  b.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"transport-fixture"}));
  b.onLoad({filter:/^link$/,namespace:"transport-fixture"},()=>({contents:'import {createElement} from "react";export default function Link(props){return createElement("a",props)}',loader:"js",resolveDir:process.cwd()}));
  b.onLoad({filter:/[\\/]public-transport[\\/]actions\.ts$/},()=>({contents:'export async function submitTransportAction(_state,form){return window.__transportUiSave("public",form)};export async function transportOperationAction(_state,form){return window.__transportUiSave("private",form)}',loader:"js"}));
 }}]});script=bundle.outputFiles[0].text;
 const files=await readdir(".next/static/chunks");styles=(await Promise.all(files.filter(f=>f.endsWith(".css")).map(f=>readFile(resolve(".next/static/chunks",f),"utf8")))).join("\n").replaceAll("../media/","/_next/static/media/");
});
async function open(page:import("@playwright/test").Page,query:string){
 await page.route("**/__public-transport-ui*",r=>r.fulfill({contentType:"text/html; charset=utf-8",body:'<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root" class="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"></main></body></html>'}));
 await page.route("**/servicios/transporte/token?*",r=>r.fulfill({contentType:"application/json",body:JSON.stringify({token:"signed-fixture-token",waitMs:2000})}));
 await page.goto(`/__public-transport-ui?${query}`);await page.addStyleTag({content:styles});await page.addScriptTag({content:script});await expect(page.getByRole("heading",{level:1})).toBeVisible();
}
test("rutas públicas desconectadas informan indisponibilidad sin sesión ni acuse falso",async({page})=>{
 await page.goto("/servicios/transporte");await expect(page.getByRole("heading",{name:"Transporte por zona",exact:true})).toBeVisible();await expect(page.getByRole("status")).toContainText("aún no está disponible");
 await page.getByRole("link",{name:"Quiero apoyar como transportista"}).click();await expect(page.getByRole("heading",{name:"Apoyá como transportista"})).toBeVisible();await expect(page.getByRole("button",{name:"Enviar solicitud"})).toHaveCount(0);
 await page.goto("/servicios/transporte/solicitar");await expect(page.getByRole("status")).toContainText("No se recibió ninguna solicitud");
 await page.goto("/transporte/operacion");await expect(page.getByRole("status")).toContainText("aún no está habilitada");
 await expect(page.getByText("transportista@example.test")).toHaveCount(0);
});
test("solicita información sin contacto ni cédula, conserva errores y entrega acuse sin cupo",async({page},info)=>{
 await open(page,"mode=passenger");await expect(page.getByLabel(/cédula/i)).toHaveCount(0);await expect(page.getByLabel("Nombre completo",{exact:true})).toHaveCount(0);
 await page.getByRole("combobox",{name:"Centro o escuela (opcional)",exact:true}).selectOption("10000000-0000-4000-8000-000000000002");
 await page.getByLabel("Horario deseado (opcional)",{exact:true}).fill("13:00");
 await page.evaluate(()=>{window.__transportUiReject=true;});await expect(page.getByRole("button",{name:"Enviar solicitud",exact:true})).toBeEnabled();await page.getByRole("button",{name:"Enviar solicitud",exact:true}).click();
 await expect(page.getByRole("alert")).toContainText("Conservamos los datos");await expect(page.getByLabel("Horario deseado (opcional)",{exact:true})).toHaveValue("13:00");
 await page.screenshot({path:info.outputPath("solicitud-transporte.png"),fullPage:true});await page.getByRole("button",{name:"Enviar solicitud",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Solicitud recibida"})).toBeVisible();await expect(page.getByRole("status")).toContainText("no confirma transporte ni reserva un cupo");
 const submitted=await page.evaluate(()=>window.__transportUiSubmissions.at(-1));expect(submitted?.kind).toBe("passenger");expect(submitted?.contact).toBe("");expect(submitted?.contactChannel).toBe("");expect(submitted?.districtId).toBe("10000000-0000-4000-8000-000000000001");
});
test("inscripción exige vehículo y contacto y no promete alta automática",async({page},info)=>{
 await open(page,"mode=driver");await page.getByLabel("Nombre completo",{exact:true}).fill("Transportista de prueba");
 await page.getByRole("combobox",{name:"Distrito o zona de disponibilidad",exact:true}).selectOption("10000000-0000-4000-8000-000000000001");
 await page.getByRole("combobox",{name:"Canal de contacto",exact:true}).selectOption("correo");await page.getByLabel("Correo electrónico",{exact:true}).fill("persona@example.test");
 await expect(page.getByLabel("Vehículo con el que te inscribís",{exact:true})).toHaveAttribute("required","");
 await page.getByRole("button",{name:"Enviar solicitud",exact:true}).click();expect(await page.evaluate(()=>window.__transportUiSubmissions.length)).toBe(0);
 await page.getByLabel("Vehículo con el que te inscribís",{exact:true}).fill("TEST-01 · Vehículo de prueba");
 await expect(page.getByRole("button",{name:"Enviar solicitud",exact:true})).toBeEnabled();await page.screenshot({path:info.outputPath("interes-transportista.png"),fullPage:true});
 await page.getByRole("button",{name:"Enviar solicitud",exact:true}).click();await expect(page.getByRole("status")).toContainText("Todavía no estás dado de alta en logística");
 expect((await page.evaluate(()=>window.__transportUiSubmissions.at(-1)))?.vehicleDetails).toBe("TEST-01 · Vehículo de prueba");
});
test("admin revisa interés y publicación; la agenda explica conflictos",async({page},info)=>{
 await open(page,"mode=ops");await expect(page.getByText("Asignado · Conflicto de horario",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Solicitudes privadas",exact:true}).click();const interest=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Transportista sintético",exact:true})});await interest.locator("summary").filter({hasText:"Revisar solicitud"}).click();
 await interest.getByRole("combobox",{name:"Decisión",exact:true}).selectOption("aprobada");await interest.getByLabel(/^Confirmé la identidad/).check();await interest.getByLabel("Motivo de revisión",{exact:true}).fill("Identidad revisada de prueba");
 await interest.getByRole("combobox",{name:"Vehículo existente",exact:true}).selectOption("10000000-0000-4000-8000-000000000003");
 await page.screenshot({path:info.outputPath("revision-transportista.png"),fullPage:true});await interest.getByRole("button",{name:"Guardar revisión",exact:true}).click();await expect(interest.getByRole("status")).toContainText("Operación registrada");
 expect((await page.evaluate(()=>window.__transportUiSubmissions.at(-1)))?.vehicleId).toBe("10000000-0000-4000-8000-000000000003");
 expect((await page.evaluate(()=>window.__transportUiSubmissions.at(-1)))?.personId).toBe("10000000-0000-4000-8000-000000000004");
 await page.getByRole("button",{name:"Servicios y publicación",exact:true}).click();const trip=page.getByRole("article").filter({has:page.getByRole("heading",{name:"Servicio de prueba",exact:true})});
 await trip.getByLabel(/^Confirmo el servicio/).check();await trip.getByRole("button",{name:"Confirmar y publicar",exact:true}).click();expect((await page.evaluate(()=>window.__transportUiSubmissions.at(-1)))?.action).toBe("publish");
 await page.locator("summary").filter({hasText:"Asignar nuevo servicio"}).click();await page.getByRole("combobox",{name:"Vehículo",exact:true}).selectOption("10000000-0000-4000-8000-000000000003");await page.getByRole("combobox",{name:"Distrito vinculado",exact:true}).selectOption("10000000-0000-4000-8000-000000000001");await page.getByLabel("Inicio · hora de Costa Rica",{exact:true}).fill("2099-11-08T09:30");await page.getByLabel("Final · hora de Costa Rica",{exact:true}).fill("2099-11-08T10:30");await expect(page.getByRole("alert")).toContainText("Conflicto de horario con este vehículo");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("A05 no recibe solicitudes ni publicación, y miembro solo consulta",async({page})=>{
 await open(page,"mode=ops&operator=1");await expect(page.getByRole("button",{name:"Solicitudes privadas",exact:true})).toHaveCount(0);await expect(page.getByText("transportista@example.test")).toHaveCount(0);await page.getByRole("button",{name:"Servicios y publicación",exact:true}).click();await expect(page.getByRole("button",{name:"Confirmar y publicar",exact:true})).toHaveCount(0);
 await open(page,"mode=ops&reader=1");await page.getByRole("button",{name:"Servicios y publicación",exact:true}).click();await expect(page.locator("summary").filter({hasText:"Asignar nuevo servicio"})).toHaveCount(0);await expect(page.getByRole("button",{name:"Cancelar y retirar oferta",exact:true})).toHaveCount(0);
});
