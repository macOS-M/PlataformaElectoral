import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const transportCookie="sipec-transport-session";
function secret(){const value=process.env.AUTH_IDENTIFIER_SECRET;if(!value||value.length<32)throw new Error("Protección de formularios sin configurar");return value;}
export function formProtectionReady(){return (process.env.AUTH_IDENTIFIER_SECRET?.length??0)>=32;}
function hmac(value:string){return createHmac("sha256",secret()).update(`public-transport:${value}`).digest("hex");}
function equal(a:string,b:string){const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export function sessionValue(existing?:string){
  if(existing&&existing.length<=200){const parts=existing.split(".");const [id,signature]=parts;if(parts.length===2&&z.uuid().safeParse(id).success&&signature&&equal(signature,hmac(`session:${id}`)))return existing;}
  const id=randomUUID();return `${id}.${hmac(`session:${id}`)}`;
}
export function issueTransportToken(session:string,scope:string,kind:"driver"|"passenger",now=Date.now()){
  const value=Buffer.from(JSON.stringify({id:randomUUID(),session:session.split(".")[0],scope,kind,issued:now})).toString("base64url");
  return `${value}.${hmac(`form:${value}`)}`;
}
export function verifyTransportToken(token:string,session:string|undefined,scope:string,kind:string,now=Date.now()){
  if(token.length>2000||!session||sessionValue(session)!==session)throw new Error("Formulario inválido");
  const parts=token.split(".");const [value,signature]=parts;
  if(parts.length!==2||!value||!signature||!equal(signature,hmac(`form:${value}`)))throw new Error("Formulario inválido");
  const parsed=z.object({id:z.uuid(),session:z.uuid(),scope:z.string(),kind:z.enum(["driver","passenger"]),issued:z.number().int()}).parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")));
  if(parsed.session!==session.split(".")[0]||parsed.scope!==scope||parsed.kind!==kind||now-parsed.issued<2000||now-parsed.issued>30*60*1000)throw new Error("Formulario vencido o incompleto");
  return {id:parsed.id,bucket:hmac(`bucket:${scope}:${parsed.session}`)};
}
export function hashTransportPayload(value:unknown){return hmac(`payload:${JSON.stringify(value)}`);}
