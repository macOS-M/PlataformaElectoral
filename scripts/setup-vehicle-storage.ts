import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { VEHICLE_DOCUMENT_BUCKET,MAX_VEHICLE_DOCUMENT_BYTES } from "../src/modules/transport/document-policy";
config({path:".env.local",quiet:true});
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Falta configuración de Storage");
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),options={public:false,fileSizeLimit:MAX_VEHICLE_DOCUMENT_BYTES,allowedMimeTypes:["application/pdf","image/jpeg","image/png"]};
 const current=await client.storage.getBucket(VEHICLE_DOCUMENT_BUCKET);const result=current.data?await client.storage.updateBucket(VEHICLE_DOCUMENT_BUCKET,options):await client.storage.createBucket(VEHICLE_DOCUMENT_BUCKET,options);if(result.error)throw new Error("No se pudo configurar Storage");
 const check=await client.storage.getBucket(VEHICLE_DOCUMENT_BUCKET);if(check.error||!check.data||check.data.public)throw new Error("Bucket privado no confirmado");console.log("Almacenamiento privado de documentos de vehículos configurado. Sin archivos reales ni movimientos SQL.");
}
main().catch(()=>{console.error("No se pudo preparar el almacenamiento de transporte. Revisá la configuración y los permisos del servidor.");process.exitCode=1;});
