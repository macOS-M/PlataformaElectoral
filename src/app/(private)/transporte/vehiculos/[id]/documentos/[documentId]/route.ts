import { getVehicleDocument } from "@/modules/transport/document-service";
import { VEHICLE_DOCUMENT_BUCKET } from "@/modules/transport/document-policy";
import { createAdminAuthClient } from "@/server/auth/admin";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
 try{const {id,documentId}=await params;const doc=await getVehicleDocument(id,documentId);if(!doc)return new Response("No encontrado",{status:404});const client=createAdminAuthClient();const bucket=await client.storage.getBucket(VEHICLE_DOCUMENT_BUCKET);if(bucket.error||!bucket.data||bucket.data.public)return new Response("Almacenamiento privado no disponible",{status:503});const {data,error}=await client.storage.from(VEHICLE_DOCUMENT_BUCKET).download(doc.storagePath);if(error||!data)return new Response("No se pudo descargar",{status:503});return new Response(data,{headers:{"Content-Type":doc.mimeType,"Content-Disposition":`attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(doc.filename).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
 catch(error){const e=error as {code?:string;cause?:{code?:string}};return new Response("Documento no disponible",{status:(e.cause?.code??e.code)==="42P01"?404:503});}
}
