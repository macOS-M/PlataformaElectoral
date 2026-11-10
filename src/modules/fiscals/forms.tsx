"use client";
import { useActionState,useId,useState } from "react";
import { Button } from "@/components/ui/button";
import { addBoardAction,assignFiscalAction,addFiscalPersonAction } from "./actions";
import type { Fiscal,FiscalPerson } from "./repository";
import type { FiscalRole } from "./schemas";
const initial={error:"",success:""};
const control="min-h-11 w-full rounded-lg border bg-card px-3 py-2 text-sm";
function Message({state}:{state:typeof initial}){return <>{state.error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{state.error}</p>}{state.success&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">{state.success}</p>}</>;}
export function BoardForm({centerId}:{centerId:string}){
 const [state,action,pending]=useActionState(addBoardAction,initial);
 return <form action={action} onReset={event=>event.preventDefault()} className="space-y-4"><input type="hidden" name="centerId" value={centerId}/><label className="grid gap-2 text-sm font-medium">Número de JRV<input name="number" type="number" min={1} max={2147483647} step={1} required className={control}/></label><label className="grid gap-2 text-sm font-medium">Fuente o referencia de la JRV<input name="sourceReference" minLength={3} maxLength={500} required placeholder="Referencia del listado donde consta la junta" className={control}/></label><p className="text-xs leading-relaxed text-muted-foreground">Registra solamente juntas que correspondan a este centro.</p><Message state={state}/><Button disabled={pending} type="submit">{pending?"Guardando…":"Registrar JRV"}</Button></form>;
}
export function FiscalPersonForm({centerId}:{centerId:string}){
 const [state,action,pending]=useActionState(addFiscalPersonAction,initial);
 return <form action={action} onReset={event=>event.preventDefault()} className="space-y-4"><input type="hidden" name="centerId" value={centerId}/><p className="text-xs text-muted-foreground">Antes de registrar, comprobá que no exista en los selectores de personas. Esta ficha se comparte con los otros módulos.</p><label className="grid gap-2 text-sm font-medium">Nombre completo<input name="fullName" minLength={2} maxLength={160} required className={control}/></label><label className="grid gap-2 text-sm font-medium">Teléfono (opcional)<input name="phone" type="tel" maxLength={40} className={control}/></label><label className="grid gap-2 text-sm font-medium">Correo (opcional)<input name="email" type="email" maxLength={254} className={control}/></label><Message state={state}/><Button disabled={pending} type="submit">{pending?"Guardando…":"Registrar persona sin crear cuenta"}</Button></form>;
}
export function FiscalForm({centerId,boardId="",role,current,people,excludedPersonIds=[]}:{centerId:string;boardId?:string;role:FiscalRole;current?:Fiscal;people:FiscalPerson[];excludedPersonIds?:string[]}){
 const [state,action,pending]=useActionState(assignFiscalAction,initial);const id=useId();
 const [person,setPerson]=useState(current?.personId??"");
 return <form action={action} onReset={event=>event.preventDefault()} className="space-y-4">
  <input type="hidden" name="centerId" value={centerId}/><input type="hidden" name="boardId" value={boardId}/><input type="hidden" name="role" value={role}/><input type="hidden" name="expectedId" value={current?.id??""}/>
  <label className="grid gap-2 text-sm font-medium" htmlFor={`${id}-person`}>Persona del directorio<select id={`${id}-person`} name="personId" value={person} onChange={e=>setPerson(e.target.value)} required={!current} className={control}><option value="">{current?"Dejar vacante / retirar asignación":"Seleccioná una persona"}</option>{people.filter(p=>p.id===current?.personId||!excludedPersonIds.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.fullName}</option>)}</select></label>
  <p className="text-xs text-muted-foreground">Se reutiliza la ficha existente. Si falta la persona, registrala primero en el directorio.</p>
  <label className="grid gap-2 text-sm font-medium">Alcance según acreditación (opcional)<textarea name="accreditationScope" maxLength={1000} rows={2} defaultValue={current?.accreditationScope??""} className={control}/></label>
  <label className="grid gap-2 text-sm font-medium">Referencia de acreditación (opcional)<input name="accreditationReference" maxLength={500} defaultValue={current?.accreditationReference??""} className={control}/></label>
  {current?<label className="grid gap-2 text-sm font-medium">Motivo del cambio o retiro<input name="reason" required minLength={3} maxLength={500} className={control}/></label>:<input type="hidden" name="reason" value=""/>}
  <Message state={state}/><Button type="submit" disabled={pending}>{pending?"Guardando…":current&&!person?"Retirar conservando historial":"Guardar asignación"}</Button>
 </form>;
}
