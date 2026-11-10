import { test,expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
let html:string;
const center="10000000-0000-4000-8000-000000000001";
test.beforeAll(async()=>{
 const result=await build({entryPoints:[resolve("tests/fixtures/center-organization-ui.tsx")],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",plugins:[{name:"center-fixture",setup(b){
  b.onResolve({filter:/^next\/link$/},a=>({path:a.path,namespace:"link-stub"}));
  b.onLoad({filter:/.*/,namespace:"link-stub"},()=>({contents:'import {createElement} from "react";export default function Link({prefetch,...props}){return createElement("a",props)}',loader:"js",resolveDir:process.cwd()}));
  b.onLoad({filter:/[\\/]voting-centers[\\/]area-service\.ts$/},()=>({contents:`export async function getCenterDetail(id){return {scope:{role:"member",editableModules:[]},center:{id,name:"Escuela de prueba",district:"Distrito de prueba"},areas:${JSON.stringify(["Signos externos","Movimientos sectoriales","Territoriales","Electorales","Transporte","Alimentación","Coordinación Día E","Redes sociales","Enlace TSE"].map((name,i)=>({id:String(i),code:`A0${i+1}`,name,assignmentId:i===4?"current":null,responsible:i===4?"Responsable sintético":null})))}}}`,loader:"js"}));
  b.onLoad({filter:/[\\/]inventory[\\/]center-summary\.tsx$/},()=>({contents:'export function CenterInventory(){return null}',loader:"js"}));
  b.onLoad({filter:/[\\/]training[\\/]actions\.ts$/},()=>({contents:'export async function saveRequirementAction(){return {error:"",success:"Guardado"}};export async function saveProgressAction(){return {error:"",success:"Guardado"}}',loader:"js"}));
 }}]});
 const files=await readdir(".next/static/chunks");const css=(await Promise.all(files.filter(f=>f.endsWith(".css")).map(f=>readFile(resolve(".next/static/chunks",f),"utf8")))).join("\n").replaceAll("../media/","/_next/static/media/");
 html=`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")}</script></body></html>`;
});
test("organigrama de centro conserva contexto y capacitación envía centro y asignación",async({page},info)=>{
 await page.route("**/__center-organization-ui*",r=>r.fulfill({contentType:"text/html",body:html}));await page.goto("/__center-organization-ui");
 await expect(page.getByRole("heading",{name:"Escuela de prueba",exact:true})).toBeVisible();await expect(page.getByText("Responsable sintético",{exact:true})).toBeVisible();await expect(page.getByText("Enlace TSE",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("link",{name:/Capacitación del equipo/})).toHaveAttribute("href",`/capacitacion?center=${center}`);await expect(page.getByRole("link",{name:/Transporte del centro/})).toHaveAttribute("href",`/transporte?center=${center}`);
 await page.screenshot({path:info.outputPath("organigrama-centro.png"),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto("/__center-organization-ui?training");await page.getByRole("button",{name:/Registrar avance/}).click();
 await expect(page.locator('form input[name="centerId"]')).toHaveValue(center);await expect(page.locator('form input[name="assignmentId"]')).toHaveValue("40000000-0000-4000-8000-000000000001");
});
