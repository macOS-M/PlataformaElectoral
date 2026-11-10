import Link from "next/link";
import { getCenterDetail } from "@/modules/voting-centers/area-service";
import { CenterOrganization } from "@/modules/organization/center-view";
import { PageHeading } from "@/components/page-heading";
export const metadata={title:"Organigrama del centro"};
export default async function CenterOrganigram({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {center}=await getCenterDetail(id);
 return <><Link href="/organigrama" className="text-sm text-primary">← Organigramas por centro</Link><PageHeading eyebrow={`Distrito ${center.district}`} title={`Organigrama · ${center.name}`} description="Responsables, vacantes y operación del centro en el evento actual."/><Link href={`/centros/${id}`} className="text-sm text-primary">Ver ficha del centro</Link><CenterOrganization centerId={id}/></>;
}
