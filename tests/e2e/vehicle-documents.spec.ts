import { test,expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
let html:string;
test.beforeAll(async()=>{
 const result=await build({entryPoints:[resolve("tests/fixtures/vehicle-documents-ui.tsx")],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",plugins:[{name:"document-fixture",setup(b){b.onLoad({filter:/[\\/]transport[\\/]document-actions\.ts$/},()=>({contents:'export async function uploadVehicleDocumentsAction(_previous,form){return window.__vehicleDocumentSave(form)}',loader:"js"}));}}]});
 const chunks=await readdir(".next/static/chunks");const css=(await Promise.all(chunks.filter(f=>f.endsWith(".css")).map(f=>readFile(resolve(".next/static/chunks",f),"utf8")))).join("\n").replaceAll("../media/","/_next/static/media/");
 html=`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")}</script></body></html>`;
});
async function open(page:import("@playwright/test").Page){await page.route("**/__vehicle-documents-ui",r=>r.fulfill({contentType:"text/html",body:html}));await page.goto("/__vehicle-documents-ui");}
test("adjunta documentos de conductor y conserva unidad, lote y archivos ante rechazo",async({page},info)=>{
 await open(page);await page.getByRole("combobox",{name:"Tipo de documento",exact:true}).selectOption("conductor");const files=page.getByLabel("Archivos del vehículo o conductor",{exact:true});await files.setInputFiles([{name:"documento-sintetico.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\nPrueba")},{name:"imagen-sintetica.png",mimeType:"image/png",buffer:Buffer.from([137,80,78,71,13,10,26,10])}]);await page.screenshot({path:info.outputPath("documentos-vehiculo.png"),fullPage:true});
 await page.evaluate(()=>{window.__vehicleDocumentReject=true;});await page.getByRole("button",{name:"Adjuntar documentos",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Conservamos");expect(await files.evaluate((input:HTMLInputElement)=>input.files?.length)).toBe(2);await page.evaluate(()=>{window.__vehicleDocumentReject=false;});await page.getByRole("button",{name:"Adjuntar documentos",exact:true}).click();await expect(page.getByRole("status")).toBeVisible();
 expect(await page.evaluate(()=>window.__vehicleDocumentSubmissions.at(-1))).toMatchObject({vehicleId:"10000000-0000-4000-8000-000000000001",conductorId:"10000000-0000-4000-8000-000000000002",batchId:"10000000-0000-4000-8000-000000000003",category:"conductor",files:JSON.stringify(["documento-sintetico.pdf","imagen-sintetica.png"])});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("limita archivos y no permite descargar documentos sin sesión",async({page})=>{
 await open(page);const files=page.getByLabel("Archivos del vehículo o conductor",{exact:true});await files.setInputFiles(Array.from({length:4},(_,n)=>({name:`prueba-${n}.pdf`,mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7")})));expect(await files.evaluate((input:HTMLInputElement)=>input.validity.customError)).toBe(true);
 await files.setInputFiles({name:"prueba.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7")});expect(await files.evaluate((input:HTMLInputElement)=>input.validity.customError)).toBe(false);const response=await page.request.get("/transporte/vehiculos/10000000-0000-4000-8000-000000000001/documentos/10000000-0000-4000-8000-000000000002");expect(response.status()).toBe(404);
});
