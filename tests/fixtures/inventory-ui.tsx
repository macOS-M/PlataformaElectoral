// Isolated browser fixture: synthetic data and a local action double, never a session bypass.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { InventoryWorkspace } from "../../src/modules/inventory/workspace";
import type { Item, Location, Stock } from "../../src/modules/inventory/repository";
type Result={error:string;success:string;id?:string};
declare global {interface Window {__inventoryUiSave:(form:FormData)=>Promise<Result>;__inventoryUiSubmissions:Record<string,string>[]}}
const itemId="10000000-0000-4000-8000-000000000001";
const warehouse="20000000-0000-4000-8000-000000000001";
const destination="20000000-0000-4000-8000-000000000002";
const person="30000000-0000-4000-8000-000000000001";
const bulkItems:Item[]=Array.from({length:200},(_,index)=>{const n=index+1;return {id:`10000000-0000-4000-8000-${String(n+1000).padStart(12,"0")}`,name:`Material de prueba ${n}`,variant:"Estándar",unit:"pieza",category:n<=100?"Pruebas A":"Pruebas B",active:true,version:1};});
function App(){
 const empty=new URL(window.location.href).searchParams.has("empty");
 const many=new URL(window.location.href).searchParams.has("many");
 const [items,setItems]=useState<Item[]>(empty?[]:[{id:itemId,name:"Banderín",variant:"Pequeño",unit:"pieza",category:"Banderas",active:true,version:1},{id:"10000000-0000-4000-8000-000000000002",name:"Camiseta",variant:"Blanca M",unit:"pieza",category:"Ropa",active:false,version:1},...(many?bulkItems:[])]);
 const [locations,setLocations]=useState<Location[]>(empty?[]:[{id:warehouse,name:"Almacén central",kind:"almacen",centerId:null},{id:destination,name:"Escuela de prueba",kind:"centro",centerId:"40000000-0000-4000-8000-000000000001"}]);
 const [stock,setStock]=useState<Stock[]>(empty?[]:[{itemId,locationId:warehouse,usable:"15.000",damaged:"2.000"},...(many?bulkItems.map((item,index)=>({itemId:item.id,locationId:warehouse,usable:(index+1)%3===0?"0":"10",damaged:(index+1)%10===0?"2":"0"})):[])]);
 useEffect(()=>{window.__inventoryUiSubmissions=[];window.__inventoryUiSave=async form=>{
   const payload=Object.fromEntries(Array.from(form.entries(),([key,value])=>[key,String(value)]));
   payload.attachmentNames=JSON.stringify(form.getAll("receipts").filter((entry):entry is File=>entry instanceof File&&entry.size>0).map(file=>file.name));
   window.__inventoryUiSubmissions.push(payload);
   if(payload.reason==="error de prueba")return {error:"No se pudo guardar. Los datos se conservan.",success:""};
   const id=payload.id||crypto.randomUUID();
   if(payload.operation==="item"&&!payload.id)setItems(old=>[...old,{id,name:payload.name,variant:payload.variant,unit:payload.unit,category:payload.category,active:true,version:1}]);
   if(payload.operation==="location")setLocations(old=>[...old,{id,name:payload.name,kind:payload.kind,centerId:null}]);
   if(payload.operation==="movement"&&payload.kind==="ingreso")setStock(old=>[...old,{itemId:payload.itemId,locationId:payload.destinationId,usable:payload.quantity,damaged:"0"}]);
   return {error:"",success:payload.operation==="item"?"Artículo creado.":"Operación de prueba registrada.",id};
 };},[]);
 return <InventoryWorkspace items={items} locations={locations} stock={stock} people={[{id:person,name:"Responsable de prueba"}]} districts={[]} centers={[]} needs={[]} pending={[]} admin={false} userId={person} today="2026-11-06"/>;
}
createRoot(document.getElementById("root")!).render(<App/>);
