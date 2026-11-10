import { NextRequest,NextResponse } from "next/server";
import { formProtectionReady,issueTransportToken,sessionValue,transportCookie } from "@/modules/public-transport/security";
import { getPublicTransportScope,scopeKey } from "@/modules/public-transport/service";
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"private, no-store"};
 const origin=request.headers.get("origin");const kind=request.nextUrl.searchParams.get("kind");
 if((origin&&origin!==request.nextUrl.origin)||(kind!=="driver"&&kind!=="passenger"))return NextResponse.json({error:"Solicitud inválida"},{status:400,headers});
 const scope=getPublicTransportScope();if(!scope||!formProtectionReady())return NextResponse.json({error:"Formulario no disponible"},{status:503,headers});
 const session=sessionValue(request.cookies.get(transportCookie)?.value);
 const response=NextResponse.json({token:issueTransportToken(session,scopeKey(scope),kind),waitMs:2000},{headers});
 response.cookies.set(transportCookie,session,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production"||(process.env.APP_SITE_URL?.startsWith("https:")??false),path:"/",maxAge:8*60*60});
 return response;
}
