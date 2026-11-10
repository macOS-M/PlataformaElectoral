import { test,expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
let html:string;
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:[resolve("tests/fixtures/fiscals-ui.tsx")],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",plugins:[{name:"fiscal-fixture",setup(b){b.onLoad({filter:/[\\/]fiscals[\\/]actions\.ts$/},()=>({contents:'export const addBoardAction=(...args)=>window.__fiscalAction(...args);export const assignFiscalAction=(...args)=>window.__fiscalAction(...args);export const addFiscalPersonAction=(...args)=>window.__fiscalAction(...args);',loader:"js"}));}}]});
 const files=await readdir(".next/static/chunks");const css=(await Promise.all(files.filter(f=>f.endsWith(".css")).map(f=>readFile(resolve(".next/static/chunks",f),"utf8")))).join("\n").replaceAll("../media/","/_next/static/media/");
 html=`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")}</script></body></html>`;
});
async function open(page:import("@playwright/test").Page,query=""){await page.route("**/__fiscals-ui*",r=>r.fulfill({contentType:"text/html",body:html}));await page.goto(`/__fiscals-ui?${query}`);}
test("distingue generales, suplentes y cobertura de JRV y permite buscar",async({page},info)=>{
 await open(page);await expect(page.getByRole("heading",{name:"Fiscales generales del centro",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Fiscal general suplente",exact:true})).toBeVisible();await expect(page.getByRole("article",{name:"JRV 101",exact:true})).toContainText("1 de 2 fiscales asignados");
 await page.screenshot({path:info.outputPath("fiscales-centro-jrv.png"),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole("searchbox",{name:"Buscar número de JRV"}).fill("102");await expect(page.getByRole("article",{name:"JRV 101",exact:true})).toHaveCount(0);await expect(page.getByRole("article",{name:"JRV 102",exact:true})).toContainText("0 de 2 fiscales asignados");
});
test("asigna suplente de mesa con centro y JRV y conserva datos ante rechazo",async({page})=>{
 await open(page);const board=page.getByRole("article",{name:"JRV 101",exact:true});const slot=board.locator("section").filter({has:page.getByRole("heading",{name:"Fiscal de mesa suplente",exact:true})});await slot.locator("summary").filter({hasText:"Asignar fiscal"}).click();const form=slot.locator("form");
 await expect(form.getByRole("option",{name:"Persona sintética 3",exact:true})).toHaveCount(0);await form.getByRole("combobox",{name:"Persona del directorio"}).selectOption(id(4));await form.getByLabel("Alcance según acreditación (opcional)").fill("Alcance registrado sintético");await page.evaluate(()=>{window.__fiscalReject=true;});await form.getByRole("button",{name:"Guardar asignación",exact:true}).click();await expect(form.getByRole("alert")).toContainText("Conservamos");await expect(form.getByRole("combobox")).toHaveValue(id(4));await expect(form.getByLabel("Alcance según acreditación (opcional)")).toHaveValue("Alcance registrado sintético");
 await page.evaluate(()=>{window.__fiscalReject=false;});await form.getByRole("button",{name:"Guardar asignación",exact:true}).click();await expect(form.getByRole("status")).toBeVisible();expect(await page.evaluate(()=>window.__fiscalSubmissions.at(-1))).toMatchObject({centerId:id(20),boardId:id(11),role:"suplente",personId:id(4),expectedId:""});
});
test("retira suplente general con motivo y referencia a su asignación",async({page})=>{
 await open(page);const slot=page.locator("section").filter({has:page.getByRole("heading",{name:"Fiscal general suplente",exact:true})}).last();await slot.locator("summary").click();const form=slot.locator("form");await form.getByRole("combobox").selectOption("");await form.getByLabel("Motivo del cambio o retiro").fill("Retiro sintético documentado");await form.getByRole("button",{name:"Retirar conservando historial",exact:true}).click();await expect(form.getByRole("status")).toBeVisible();expect(await page.evaluate(()=>window.__fiscalSubmissions.at(-1))).toMatchObject({role:"general_suplente",boardId:"",expectedId:id(32),personId:""});
});
test("lector sin formularios y centro sin juntas no fabrica mesas",async({page})=>{
 await open(page,"reader&empty");await expect(page.getByText("Este centro aún no tiene JRV registradas.",{exact:false})).toBeVisible();await expect(page.getByRole("article")).toHaveCount(0);await expect(page.locator("form")).toHaveCount(0);
 await page.goto(`/centros/${id(20)}/fiscales`);await expect(page.getByRole("heading",{name:"No encontramos esta página",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Guardar asignación",exact:true})).toHaveCount(0);
});
