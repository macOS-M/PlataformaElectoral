import { createRoot } from "react-dom/client";
import { CenterOrganization } from "../../src/modules/organization/center-view";
import { TrainingWorkspace } from "../../src/modules/training/workspace";
const center="10000000-0000-4000-8000-000000000001";
const root=createRoot(document.getElementById("root")!);
const row={centerId:center,positionId:"20000000-0000-4000-8000-000000000001",name:"Transporte",requirementId:"30000000-0000-4000-8000-000000000001",required:true,scheduledOn:"2020-01-01",revision:1,assignmentId:"40000000-0000-4000-8000-000000000001",personName:"Responsable sintético",progressId:null,status:null,statusOn:null};
if(location.search.includes("training"))root.render(<main className="mx-auto max-w-6xl space-y-5 p-5"><h1 className="text-2xl font-semibold">Capacitación · Escuela de prueba</h1><TrainingWorkspace rows={[row]} history={[]} canEdit today="2026-11-09" configured/></main>);
else CenterOrganization({centerId:center}).then(view=>root.render(<main className="mx-auto max-w-6xl space-y-5 p-5"><h1 className="text-2xl font-semibold">Organigrama del centro</h1>{view}</main>));
