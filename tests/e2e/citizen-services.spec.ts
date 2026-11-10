import { expect,test } from "@playwright/test";
import { build } from "esbuild";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
let html:string;
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
test.beforeAll(async()=>{
 const result=await build({entryPoints:[resolve("tests/fixtures/citizen-services-ui.tsx")],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",plugins:[{name:"citizen-fixture",setup(b){
  b.onResolve({filter:/^next\/(link|image)$/},a=>({path:a.path,namespace:"citizen-stub"}));
  b.onLoad({filter:/.*/,namespace:"citizen-stub"},a=>({contents:a.path==="next/link"?'import {createElement} from "react";export default function Link({prefetch,...props}){return createElement("a",props)}':'import {createElement} from "react";export default function Image({unoptimized,...props}){return createElement("img",props)}',loader:"js",resolveDir:process.cwd()}));
  b.onLoad({filter:/[\\/]public-transport[\\/]actions\.ts$/},()=>({contents:'export async function submitTransportAction(_state,form){return window.__citizenRequest(form)}',loader:"js"}));
 }}]});
 const files=await readdir(".next/static/chunks");const css=(await Promise.all(files.filter(f=>f.endsWith(".css")).map(f=>readFile(resolve(".next/static/chunks",f),"utf8")))).join("\n").replaceAll("../media/","/_next/static/media/");
 html=`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")}</script></body></html>`;
});
async function prepare(page:import("@playwright/test").Page){
 for(const route of ["**/__citizen-services-ui*","**/servicios?*","**/servicios/transporte/solicitar?*"])await page.route(route,r=>r.fulfill({contentType:"text/html; charset=utf-8",body:html}));
 await page.route("**/servicios/transporte/token?*",r=>r.fulfill({contentType:"application/json",body:JSON.stringify({token:"fixture-token",waitMs:2000})}));
}
test("la portada conduce al distrito y su transporte sin accesos generales anticipados",async({page},info)=>{
 await page.goto("/");await expect(page.getByRole("link",{name:"Ver transporte por centro o distrito",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Ver servicios disponibles",exact:true}).locator("..")).toHaveAttribute("action","/servicios");
 await prepare(page);await page.goto("/__citizen-services-ui");await page.getByRole("combobox",{name:"Provincia",exact:true}).selectOption(id(1));await page.getByRole("combobox",{name:"Cantón",exact:true}).selectOption(id(2));await page.getByRole("combobox",{name:"Distrito",exact:true}).selectOption(id(3));await page.getByRole("button",{name:"Ver servicios disponibles",exact:true}).click();
 await expect(page).toHaveURL(/\/servicios\?/);await expect(page.getByRole("heading",{name:"Servicios en Distrito de prueba",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Transporte en tu zona",exact:true})).toBeVisible();await expect(page.getByRole("article")).toHaveCount(2);await expect(page.getByRole("link",{name:"Consultar dónde votar",exact:true})).toHaveAttribute("href","https://www.tse.go.cr/DondeVotar/");
 await page.screenshot({path:info.outputPath("servicios-distrito.png"),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("filtra escuela y conserva distrito/centro al solicitar y volver del acuse",async({page})=>{
 await prepare(page);await page.goto(`/servicios?canton=${id(2)}&district=${id(3)}`);await page.getByRole("combobox",{name:"¿Buscás transporte para una escuela?",exact:true}).selectOption(id(8));await page.getByRole("button",{name:"Filtrar transporte",exact:true}).click();await expect(page.getByRole("article")).toHaveCount(1);
 await page.getByRole("link",{name:"Solicitar transporte",exact:true}).click();await expect(page.getByRole("combobox",{name:"Distrito",exact:true})).toHaveValue(id(3));await expect(page.getByRole("combobox",{name:"Centro o escuela (opcional)",exact:true})).toHaveValue(id(8));await expect(page.getByRole("button",{name:"Enviar solicitud",exact:true})).toBeEnabled();await page.getByRole("button",{name:"Enviar solicitud",exact:true}).click();await expect(page.getByRole("status")).toContainText("no confirma transporte ni reserva un cupo");await page.getByRole("link",{name:"Volver a consultar servicios",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Servicios en Distrito de prueba",exact:true})).toBeVisible();await expect(page.getByRole("combobox",{name:"¿Buscás transporte para una escuela?",exact:true})).toHaveValue(id(8));
});
test("distingue vacío de indisponibilidad y no habilita denuncias",async({page},info)=>{
 await prepare(page);await page.goto(`/servicios?canton=${id(2)}&district=${id(3)}&empty=1`);await expect(page.getByRole("heading",{name:"Sin transporte publicado",exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Solicitar transporte",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Denuncias ciudadanas",exact:true})).toBeVisible();await expect(page.getByRole("link",{name:/denuncia/i})).toHaveCount(0);await page.screenshot({path:info.outputPath("servicios-sin-rutas.png"),fullPage:true});
 await page.goto(`/servicios?canton=${id(2)}&district=${id(3)}&unavailable=1`);await expect(page.getByRole("heading",{name:"La consulta de transporte aún no está disponible",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Sin transporte publicado",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Solicitudes aún no disponibles",exact:true})).toBeDisabled();await expect(page.getByRole("link",{name:"Consultar dónde votar",exact:true})).toBeVisible();
});
test("servicios sin selección no muestra transporte y permite volver al inicio",async({page})=>{
 for(const path of ["/servicios","/servicios?canton=invalido&district=invalido"]){
  await page.goto(path);await expect(page).toHaveURL(/\/$/);await expect(page.getByRole("heading",{name:"Elegí tu distrito",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Ver servicios disponibles",exact:true})).toBeVisible();
 }
});
