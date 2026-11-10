"use client";
import { useActionState, useState } from "react";
import { inventoryAction } from "./actions";
import { kinds, units } from "./schemas";
import { MAX_RECEIPT_BYTES,MAX_RECEIPT_FILES } from "./receipt-policy";
import type { Item, Location, Need, Option } from "./repository";
import { Button } from "@/components/ui/button";
const unitNames:Record<string,string>={pieza:"Piezas",caja:"Cajas",paquete:"Paquetes",docena:"Docenas",metro:"Metros",litro:"Litros",kilogramo:"Kilogramos"};
const control = "min-h-11 w-full rounded-lg border bg-card px-3 py-2 text-sm";
function Field({ label, children }: { label:string; children:React.ReactNode }) { return <label className="grid gap-2 text-sm"><span>{label}</span>{children}</label>; }
function Select({ name, options, required=true }: {name:string;options:Option[];required?:boolean}) { return <select name={name} required={required} defaultValue="" className={control}><option value="">Seleccioná una opción</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>; }
type Completion = (result: {id?:string; success:string}) => void;
type FormCallbacks = { onSaved?:Completion; onBusy?:(busy:boolean)=>void };
function Form({ operation, children, submit, onSaved, onBusy, onSubmit }: {
  operation:string; children:React.ReactNode; submit:string; onSubmit?:React.FormEventHandler<HTMLFormElement>;
} & FormCallbacks) {
  const [state, action, pending] = useActionState(async (previous: {error:string;success:string;id?:string}, form:FormData) => {
    onBusy?.(true);
    try {
      const result = await inventoryAction(previous, form);
      if (result.success) onSaved?.(result);
      return result;
    } catch { return {error:"No se pudo completar el guardado. Revisá la conexión y volvé a intentar.",success:""}; }
    finally { onBusy?.(false); }
  }, {error:"",success:""});
  return <form action={action} onSubmit={onSubmit} onReset={event=>event.preventDefault()} className="grid gap-4" aria-busy={pending}>
    <input type="hidden" name="operation" value={operation}/>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state.success && !onSaved && <p role="status" className="rounded-lg bg-muted p-3 text-sm text-primary">{state.success}</p>}
    <Button disabled={pending} type="submit" className="min-h-11">{pending?"Guardando…":submit}</Button>
  </form>;
}
export function ItemForm({ item, categories=[], onSaved, onBusy }: {item?:Item;categories?:string[]} & FormCallbacks) {
 return <Form operation="item" submit={item?"Guardar cambios":"Crear artículo"} onSaved={onSaved} onBusy={onBusy}>
  <input type="hidden" name="id" value={item?.id??""}/><input type="hidden" name="version" value={item?.version??0}/>
  <Field label="Nombre"><input name="name" required minLength={2} maxLength={120} placeholder="Ej. Camiseta" defaultValue={item?.name} readOnly={!!item} className={control}/></Field>
  <Field label="Variante (talla, color o presentación)"><input name="variant" maxLength={100} placeholder="Ej. Blanca · talla M" defaultValue={item?.variant} readOnly={!!item} className={control}/></Field>
  <Field label="Unidad"><select name="unit" defaultValue={item?.unit??"pieza"} className={control}>{(item?[item.unit]:units).map(u=><option key={u} value={u}>{unitNames[u]??u}</option>)}</select></Field>
  <Field label="Categoría"><input name="category" required minLength={2} maxLength={80} placeholder="Ej. Ropa o banderas" list="inventory-categories" defaultValue={item?.category} className={control}/><datalist id="inventory-categories">{categories.map(c=><option key={c} value={c}/>)}</datalist></Field>
  {item?<label className="flex min-h-11 items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={item.active}/>Artículo activo</label>:<><input type="hidden" name="active" value="on"/><p className="text-xs text-muted-foreground">El artículo se creará activo. En el siguiente paso podrás agregar sus existencias.</p></>}
  {item && <Field label="Motivo del cambio"><input name="reason" required minLength={3} maxLength={500} className={control}/></Field>}
 </Form>;
}
export function LocationForm({ districts, centers, people, onSaved, onBusy }: {districts:Option[];centers:Option[];people:Option[]} & FormCallbacks) {
 const [kind,setKind]=useState("almacen");
 const options=kind==="centro"?centers:kind==="distrito"?districts:people;
 return <Form operation="location" submit="Crear ubicación" onSaved={onSaved} onBusy={onBusy}>
  <Field label="Tipo de ubicación"><select name="kind" value={kind} onChange={e=>setKind(e.target.value)} className={control}>{[["almacen","Almacén"],["distrito","Distrito"],["centro","Centro de votación"],["persona","Custodia de persona"]].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></Field>
  {kind==="almacen"?<Field label="Nombre del almacén"><input name="name" required minLength={2} maxLength={160} className={control}/></Field>:<Field label="Destino existente"><Select key={kind} name="referenceId" options={options}/></Field>}
 </Form>;
}
export function MovementForm({ items, locations, people, stock, requestId, today, initialKind="ingreso", initialItemId="", initialLocationId="", initialDestinationId="", onSaved, onBusy }: {
  items:Item[]; locations:Location[]; people:Option[]; stock:import("./repository").Stock[]; requestId:string; today:string;
  initialKind?:typeof kinds[number]; initialItemId?:string; initialLocationId?:string; initialDestinationId?:string;
} & FormCallbacks) {
  const kind=initialKind;
  const eligibleItems=items.filter(i=>i.active&&(!initialDestinationId||stock.some(s=>s.itemId===i.id&&s.locationId!==initialDestinationId&&Number(s.usable)>0&&locations.some(l=>l.id===s.locationId))));
  const [itemId,setItemId]=useState(initialItemId||(initialDestinationId&&eligibleItems.length===1?eligibleItems[0].id:""));
  const item=items.find(i=>i.id===itemId);
  const sourceOptions=locations.filter(l=>l.id!==initialDestinationId&&stock.some(s=>s.itemId===itemId&&s.locationId===l.id&&Number(kind==="baja"?s.damaged:s.usable)>0));
  const [source,setSource]=useState(kind==="ingreso"?"":initialLocationId || (sourceOptions.length===1?sourceOptions[0].id:""));
  const warehouses=locations.filter(l=>l.kind==="almacen");
  const [destination,setDestination]=useState(kind==="ingreso"?(initialLocationId||(warehouses.length===1?warehouses[0].id:"")):initialDestinationId);
  const [quantity,setQuantity]=useState("");
  const [review,setReview]=useState<Record<string,string>|null>(null);
  const [receipts,setReceipts]=useState<File[]>([]);
  const balance=stock.find(s=>s.itemId===itemId&&s.locationId===source);
  const available=Number(kind==="baja"?balance?.damaged??0:balance?.usable??0);
  const integer=item&&["pieza","caja","paquete","docena"].includes(item.unit);
  const approval=["perdida","robo","baja"].includes(kind);
  const destinationOptions=(kind==="ingreso"?warehouses:locations).filter(l=>l.id!==source);
  const sourceName=locations.find(l=>l.id===source)?.name;
  const destinationName=locations.find(l=>l.id===destination)?.name;
  const explanation=kind==="ingreso"?"Sumá el material que recibiste en un almacén."
    :kind==="transferencia"?"El material sale de una ubicación y queda disponible en otra."
    :kind==="consumo"?"Registrá material que ya se utilizó. No se traslada a otro lugar."
    :kind==="dano"?"Separá material dañado sin eliminarlo del inventario físico."
    :"Se enviará una solicitud para que otro administrador revise el ajuste.";
  return <Form operation="movement" submit={review?(approval?"Enviar solicitud":"Confirmar movimiento"):"Revisar movimiento"} onSaved={onSaved} onBusy={onBusy}
    onSubmit={event=>{if(!review){event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));setReview(Object.fromEntries(Object.entries(values).map(([key,value])=>[key,String(value)])));}}}>
    <input name="requestId" type="hidden" value={requestId}/><input name="kind" type="hidden" value={kind}/>
    <ol aria-label="Pasos del movimiento" className="flex gap-3 text-xs font-medium"><li className={!review?"text-primary":"text-muted-foreground"}>1. Datos</li><li className={review?"text-primary":"text-muted-foreground"}>2. Confirmación</li></ol>
    <div hidden={!!review} className="space-y-4">
      <p className="text-sm text-muted-foreground">{explanation}</p>
      <Field label="Artículo"><select name="itemId" value={itemId} required className={control} onChange={e=>{setItemId(e.target.value);setSource("");setQuantity("");}}><option value="">Seleccioná un artículo</option>{eligibleItems.map(i=><option key={i.id} value={i.id}>{i.name} {i.variant} · {i.unit}</option>)}</select></Field>
      {kind!=="ingreso"&&<Field label="¿De dónde sale?"><select name="sourceId" value={source} required onChange={e=>{setSource(e.target.value);setDestination(initialDestinationId);setQuantity("");}} className={control}><option value="">Elegí una ubicación con stock</option>{sourceOptions.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>}
      {["ingreso","transferencia"].includes(kind)&&<Field label={kind==="ingreso"?"¿En qué almacén lo recibís?":"¿Dónde lo entregás?"}><select name="destinationId" value={destination} required onChange={e=>setDestination(e.target.value)} className={control}><option value="">Elegí el destino</option>{destinationOptions.map(l=><option key={l.id} value={l.id}>{l.name} · {l.kind}</option>)}</select></Field>}
      {item&&kind!=="ingreso"&&<p role="status" className="rounded-lg bg-muted p-3 text-sm">{source?`Disponible en ${sourceName}: ${available.toLocaleString("es-CR")} ${item.unit}${kind==="baja"?" dañadas":""}`:sourceOptions.length?"Elegí una ubicación para ver su saldo.":"Este artículo no tiene stock disponible para esta operación."}</p>}
      <Field label={`Cantidad${item?` (${item.unit})`:""}`}><input name="quantity" type="number" required min={integer?1:0.001} step={integer?1:0.001} max={kind==="ingreso"?99999999999:available||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0" className={control}/></Field>
      <Field label={kind==="transferencia"?"¿Quién recibe el material?":"Persona responsable"}><select name="personId" required defaultValue={people.length===1?people[0].id:""} className={control}><option value="">Seleccioná una persona</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      {!people.length&&<p className="text-sm text-muted-foreground">Primero registrá a la persona responsable en la plataforma.</p>}
      {kind==="ingreso"&&<Field label="¿De dónde viene el material?"><input name="origin" required minLength={2} maxLength={160} placeholder="Ej. Compra o donación" className={control}/></Field>}
      <Field label="Motivo"><textarea name="reason" required minLength={3} maxLength={500} placeholder={kind==="ingreso"?"Ej. Recepción de material para la jornada":"Contá brevemente qué ocurrió"} className={control}/></Field>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Fecha y comprobante</summary><div className="mt-3 grid gap-3">
        <Field label="Fecha"><input name="occurredOn" type="date" required max={today} defaultValue={today} className={control}/></Field>
        <Field label="Referencia del comprobante (opcional)"><input name="evidence" maxLength={500} placeholder="Número o referencia" className={control}/></Field>
        <Field label="Adjuntar comprobantes (opcional)"><input name="receipts" type="file" multiple accept="application/pdf,image/jpeg,image/png" aria-describedby="receipt-file-help" className={control} onChange={event=>{const files=Array.from(event.currentTarget.files??[]);setReceipts(files);event.currentTarget.setCustomValidity(files.length>MAX_RECEIPT_FILES||files.reduce((n,f)=>n+f.size,0)>MAX_RECEIPT_BYTES?"Adjuntá hasta 3 archivos, con un máximo de 5 MB entre todos.":"");}}/></Field>
        <p id="receipt-file-help" className="text-xs leading-relaxed text-muted-foreground">Hasta 3 archivos PDF, JPG o PNG. Máximo 5 MB entre todos. Se guardan de forma privada junto al movimiento.</p>
      </div></details>
    </div>
    {review&&<div className="space-y-4">
      <h3 className="font-semibold">Revisá antes de guardar</h3>
      <dl className="grid gap-3 rounded-xl bg-muted p-4 text-sm">
        <div><dt className="text-muted-foreground">Artículo</dt><dd className="font-semibold">{item?.name} {item?.variant}</dd></div>
        <div><dt className="text-muted-foreground">Cantidad</dt><dd className="text-2xl font-semibold">{review.quantity} <span className="text-sm font-normal">{item?.unit}</span></dd></div>
        {sourceName&&<div><dt className="text-muted-foreground">Origen</dt><dd>{sourceName}</dd></div>}
        {destinationName&&<div><dt className="text-muted-foreground">Destino</dt><dd>{destinationName}</dd></div>}
        <div><dt className="text-muted-foreground">Responsable / receptor</dt><dd>{people.find(p=>p.id===review.personId)?.name}</dd></div>
        <div><dt className="text-muted-foreground">Motivo</dt><dd className="break-words">{review.reason}</dd></div>
        <div><dt className="text-muted-foreground">Fecha</dt><dd>{review.occurredOn}</dd></div>
        {review.origin&&<div><dt className="text-muted-foreground">Origen del material</dt><dd className="break-words">{review.origin}</dd></div>}
        {review.evidence&&<div><dt className="text-muted-foreground">Comprobante</dt><dd className="break-words">{review.evidence}</dd></div>}
        {!!receipts.length&&<div><dt className="text-muted-foreground">Archivos adjuntos</dt><dd><ul className="space-y-1">{receipts.map((file,index)=><li key={index} className="break-all">{file.name} · {Math.ceil(file.size/1024)} KB</li>)}</ul></dd></div>}
      </dl>
      {!approval&&sourceName&&item&&<p className="rounded-lg bg-muted p-3 text-sm">{kind==="dano"?"Utilizable en origen":"Disponible en origen"}: {available.toLocaleString("es-CR")} → {(available-Number(review.quantity)).toLocaleString("es-CR")} {item.unit}</p>}
      <p className="text-sm text-muted-foreground">{approval?"El stock no cambiará hasta la aprobación de otro administrador.":kind==="ingreso"?`Se agregarán ${review.quantity} ${item?.unit} al almacén.`:kind==="dano"?`${review.quantity} ${item?.unit} pasarán de utilizables a dañadas.`:kind==="transferencia"?"Se descontará del origen y se sumará al destino en el mismo movimiento.":`Se descontarán ${review.quantity} ${item?.unit} del stock utilizable.`}</p>
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={()=>setReview(null)}>Volver a los datos</Button>
    </div>}
  </Form>;
}
export function NeedForm({ items, locations, needs, onSaved, onBusy }: {items:Item[];locations:Location[];needs:Need[]} & FormCallbacks) {
 const [item,setItem]=useState("");const [location,setLocation]=useState("");const previous=needs.find(n=>n.itemId===item&&n.locationId===location);
 return <Form operation="need" submit="Guardar meta" onSaved={onSaved} onBusy={onBusy}>
  <input type="hidden" name="expectedId" value={previous?.id??""}/>
  <Field label="Artículo requerido"><select name="itemId" value={item} required onChange={e=>setItem(e.target.value)} className={control}><option value="">Seleccioná un artículo</option>{items.filter(i=>i.active).map(i=><option key={i.id} value={i.id}>{i.name} {i.variant} · {i.unit}</option>)}</select></Field>
  <Field label="Destino de la meta"><select name="locationId" value={location} required onChange={e=>setLocation(e.target.value)} className={control}><option value="">Seleccioná un destino</option>{locations.filter(l=>l.kind!=="almacen").map(l=><option key={l.id} value={l.id}>{l.kind} · {l.name}</option>)}</select></Field>
  <Field label="Cantidad requerida"><input key={previous?.id??"new"} name="quantity" type="number" min="0" step="0.001" required defaultValue={previous?.required} className={control}/></Field>
 </Form>;
}
export function DecisionForm({ movementId, onSaved, onBusy }: {movementId:string} & FormCallbacks) { return <Form operation="decision" submit="Registrar decisión" onSaved={onSaved} onBusy={onBusy}>
 <input type="hidden" name="movementId" value={movementId}/>
 <Field label="Decisión"><select name="approved" className={control}><option value="false">Rechazar</option><option value="true">Aprobar ajuste de stock</option></select></Field>
 <Field label="Motivo de la decisión"><textarea name="reason" required minLength={3} maxLength={500} className={control}/></Field>
 </Form>; }
