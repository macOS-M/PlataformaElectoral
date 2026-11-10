import { getInventoryReceipt } from "@/modules/inventory/receipt-download";
import { RECEIPT_BUCKET } from "@/modules/inventory/receipt-policy";
import { createAdminAuthClient } from "@/server/auth/admin";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;const receipt=await getInventoryReceipt(id);
  if(!receipt)return new Response("No encontrado",{status:404});
  const client=createAdminAuthClient();const bucket=await client.storage.getBucket(RECEIPT_BUCKET);
  if(bucket.error||!bucket.data||bucket.data.public)return new Response("El almacenamiento privado no está disponible",{status:503});
  const {data,error}=await client.storage.from(RECEIPT_BUCKET).download(receipt.storagePath);
  if(error||!data)return new Response("No se pudo descargar el comprobante",{status:503});
  return new Response(data,{headers:{"Content-Type":receipt.mimeType,"Content-Disposition":`attachment; filename="comprobante"; filename*=UTF-8''${encodeURIComponent(receipt.filename).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(error){const e=error as {code?:string;cause?:{code?:string}};return new Response((e.cause?.code??e.code)==="42P01"?"No encontrado":"No se pudo consultar el comprobante",{status:(e.cause?.code??e.code)==="42P01"?404:503});}
}
