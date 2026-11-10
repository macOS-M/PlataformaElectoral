import { NextRequest, NextResponse } from "next/server";
import { exportInventory } from "@/modules/inventory/service";
export async function GET(request: NextRequest) {
 try {
  const query:Record<string,unknown>={};
  for(const key of request.nextUrl.searchParams.keys()) {const values=request.nextUrl.searchParams.getAll(key);query[key]=values.length===1?values[0]:values;}
  const csv=await exportInventory(query);
  return new NextResponse(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="inventario.csv"',"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 } catch {return new NextResponse("No se pudo exportar. Revisa permisos y acota los filtros a 10000 movimientos.",{status:403,headers:{"Cache-Control":"private, no-store"}});}
}
