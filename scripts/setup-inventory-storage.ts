import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { RECEIPT_BUCKET,MAX_RECEIPT_BYTES } from "../src/modules/inventory/receipt-policy";
config({path:".env.local",quiet:true});
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error("Falta configuración de Storage en servidor");
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const options={public:false,fileSizeLimit:MAX_RECEIPT_BYTES,allowedMimeTypes:["application/pdf","image/jpeg","image/png"]};
 const current=await client.storage.getBucket(RECEIPT_BUCKET);
 const result=current.data?await client.storage.updateBucket(RECEIPT_BUCKET,options):await client.storage.createBucket(RECEIPT_BUCKET,options);
 if(result.error)throw new Error("No se pudo configurar el bucket privado de comprobantes");
 const check=await client.storage.getBucket(RECEIPT_BUCKET);
 if(check.error||!check.data||check.data.public)throw new Error("No se confirmó el bucket privado");
 console.log("Bucket privado de comprobantes de inventario configurado. No se cargaron archivos.");
}
main().catch(()=>{console.error("No se pudo preparar el almacenamiento privado. Revisá la configuración y los permisos del servidor.");process.exitCode=1;});
