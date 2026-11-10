import { getPublicPortal } from "@/modules/public-portal/service";
import { getPublicTransport } from "@/modules/public-transport/service";
import { CitizenServicesView } from "@/modules/public-portal/services-view";
import { redirect } from "next/navigation";
import type { TerritoryQuery } from "@/modules/public-portal/types";
export const metadata={title:"Servicios de tu distrito"};
export const dynamic="force-dynamic";
export default async function CitizenServicesPage({searchParams}:{searchParams:Promise<TerritoryQuery&{center?:string|string[]}>}){
 const query=await searchParams;const portal=await getPublicPortal(query);
 if(!portal.selection) redirect("/");
 const transport=await getPublicTransport({district:portal.selection.district.id,center:query.center});
 return <CitizenServicesView selection={portal.selection} transport={transport}/>;
}
