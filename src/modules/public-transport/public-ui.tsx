"use client";
import { useActionState,useEffect,useState } from "react";
import { CheckCircle2,RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitTransportAction } from "./actions";
import { MAX_TRANSPORT_REQUEST_TIME } from "./policy";

export type ZoneOptions={districts:{id:string;name:string}[];centers:{id:string;name:string;districtId:string}[]};
const control="min-h-11 w-full rounded-lg border bg-card px-3 py-2 text-sm";
export function TransportZoneFields({districts,centers,driver=false,query=false,initialDistrict="",initialCenter=""}:ZoneOptions&{driver?:boolean;query?:boolean;initialDistrict?:string;initialCenter?:string}){
 const [district,setDistrict]=useState(initialDistrict);const [center,setCenter]=useState(initialCenter);
 return <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">{driver?"Distrito o zona de disponibilidad":"Distrito"}<select name={query?"district":"districtId"} value={district} required={!query&&!center} onChange={e=>{setDistrict(e.target.value);setCenter("");}} className={control}><option value="">{query?"Todos los distritos":"Elegí un distrito"}</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 {driver?<input type="hidden" name="centerId" value=""/>:<label className="grid gap-2 text-sm font-medium">Centro o escuela (opcional)<select name={query?"center":"centerId"} value={center} onChange={e=>{setCenter(e.target.value);const selected=centers.find(c=>c.id===e.target.value);if(selected)setDistrict(selected.districtId);}} className={control}><option value="">{query?"Todos los centros":"Solo distrito, sin centro específico"}</option>{centers.filter(c=>!district||c.districtId===district).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}</div>;
}
export function PublicTransportForm({kind,cantonId,initialDistrict="",initialCenter="",...options}:ZoneOptions&{kind:"driver"|"passenger";cantonId?:string;initialDistrict?:string;initialCenter?:string}){
 const [token,setToken]=useState("");const [ready,setReady]=useState(false);const [tokenError,setTokenError]=useState(false);const [generation,setGeneration]=useState(0);
 const [channel,setChannel]=useState("");const [contact,setContact]=useState("");
 const [returnHref,setReturnHref]=useState("/");
 const [state,action,pending]=useActionState(submitTransportAction,{error:"",receipt:""});
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  fetch(`/servicios/transporte/token?kind=${kind}`,{cache:"no-store",signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();const data=await r.json();if(typeof data.token!=="string")throw new Error();if(controller.signal.aborted)return;setToken(data.token);timer=setTimeout(()=>setReady(true),Math.max(2000,Number(data.waitMs)||2000));}).catch(()=>{if(!controller.signal.aborted)setTokenError(true);});
  return ()=>{controller.abort();if(timer)clearTimeout(timer);};
 },[kind,generation]);
 if(state.receipt)return <div role="status" className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><CheckCircle2 size={28} aria-hidden="true"/><h2 className="text-xl font-semibold">Solicitud recibida</h2><p className="text-sm leading-relaxed">{kind==="driver"?"Tu interés quedó pendiente de revisión administrativa. Todavía no estás dado de alta en logística.":"Tu solicitud quedó pendiente de revisión. Este acuse no confirma transporte ni reserva un cupo."}</p><p className="break-all text-xs">Referencia: {state.receipt}</p><a href={returnHref} className="inline-block py-2 text-sm font-semibold underline">Volver a consultar servicios</a></div>;
 return <form action={action} onReset={event=>event.preventDefault()} onSubmit={event=>{const fields=new FormData(event.currentTarget);const district=String(fields.get("districtId")??"");const center=String(fields.get("centerId")??"");if(cantonId&&district){const params=new URLSearchParams({canton:cantonId,district});if(center)params.set("center",center);setReturnHref(`/servicios?${params}`);}}} className="space-y-5">
  <input type="hidden" name="kind" value={kind}/><input type="hidden" name="formToken" value={token}/>
  <div aria-hidden="true" className="absolute -left-[10000px] h-0 overflow-hidden"><label>Dejá este campo vacío<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  {kind==="driver"?<label className="grid gap-2 text-sm font-medium">Nombre completo<input name="name" required minLength={2} maxLength={160} autoComplete="name" className={control}/></label>:<input type="hidden" name="name" value=""/>}
  <TransportZoneFields {...options} driver={kind==="driver"} initialDistrict={initialDistrict} initialCenter={kind==="driver"?"":initialCenter}/>
  {kind==="driver"?<><label className="grid gap-2 text-sm font-medium">Vehículo con el que te inscribís<input name="vehicleDetails" required minLength={2} maxLength={160} placeholder="Placa, tipo y descripción breve del vehículo" className={control}/></label><input type="hidden" name="desiredTime" value=""/></>:<><input type="hidden" name="vehicleDetails" value=""/><div className="space-y-2"><label className="grid gap-2 text-sm font-medium">Horario deseado (opcional)<input name="desiredTime" type="time" max={MAX_TRANSPORT_REQUEST_TIME} aria-describedby="desired-time-help" className={control}/></label><p id="desired-time-help" className="text-xs leading-relaxed text-muted-foreground">Podés solicitar transporte hasta las 5:00 p. m. (hora de Costa Rica).</p></div></>}
  <fieldset className="space-y-4 rounded-xl border bg-muted/20 p-4"><legend className="px-1 text-sm font-semibold">{kind==="driver"?"Contacto para la revisión":"Medio de respuesta voluntario"}</legend>
   <label className="grid gap-2 text-sm font-medium">Canal de contacto<select name="contactChannel" value={channel} required={kind==="driver"} onChange={e=>{setChannel(e.target.value);setContact("");}} className={control}><option value="">{kind==="driver"?"Elegí teléfono o correo":"No deseo indicar un medio de respuesta"}</option><option value="telefono">Teléfono</option><option value="correo">Correo electrónico</option></select></label>
   {channel?<label className="grid gap-2 text-sm font-medium">{channel==="correo"?"Correo electrónico":"Teléfono"}<input name="contact" type={channel==="correo"?"email":"tel"} value={contact} onChange={e=>setContact(e.target.value)} required maxLength={channel==="correo"?254:40} className={control}/></label>:<input type="hidden" name="contact" value=""/>}
   <p className="text-xs leading-relaxed text-muted-foreground">{kind==="driver"?"Estos datos son privados y se usan para revisar tu solicitud.":"Podés enviar la solicitud sin contacto. Si no lo indicás, no podremos responderte por un canal personal."} No se envían mensajes automáticos.</p>
  </fieldset>
  {state.error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900">{state.error}</p>}
  {tokenError&&<p role="alert" className="text-sm text-red-900">El formulario no está disponible en este momento.</p>}
  <div className="flex flex-wrap gap-3"><Button className="min-h-11" disabled={!ready||pending||tokenError} type="submit">{pending?"Enviando…":ready?"Enviar solicitud":"Preparando formulario…"}</Button><Button variant="outline" className="min-h-11" type="button" disabled={pending} onClick={()=>{setToken("");setReady(false);setTokenError(false);setGeneration(v=>v+1);}}><RefreshCw size={15} aria-hidden="true"/>Renovar formulario</Button></div>
  <p className="text-xs leading-relaxed text-muted-foreground">El acuse se muestra aquí después de guardar. No ingresés cédulas ni otros documentos de identidad.</p>
  <noscript>Activá JavaScript para completar la protección del formulario.</noscript>
 </form>;
}
