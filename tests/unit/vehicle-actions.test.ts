import { beforeEach,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({plain:vi.fn(),documents:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/modules/transport/service",()=>({updateVehicle:mocks.plain}));
vi.mock("@/modules/transport/registration-service",()=>({registerVehicleWithDocuments:mocks.documents}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { saveVehicleAction } from "@/modules/transport/actions";
const id="10000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.resetAllMocks();mocks.plain.mockResolvedValue(id);mocks.documents.mockResolvedValue(id);});
it("con documentos usa exclusivamente el guardado conjunto y mantiene todos los archivos",async()=>{
 const form=new FormData();form.append("districtIds",id);form.append("documents",new File(["%PDF-1.7"],"prueba.pdf",{type:"application/pdf"}));form.append("documents",new File(["%PDF-1.7"],"otra.pdf",{type:"application/pdf"}));
 expect(await saveVehicleAction({error:"",success:""},form)).toMatchObject({id,error:""});expect(mocks.documents.mock.calls[0][1]).toHaveLength(2);expect(mocks.documents.mock.calls[0][0]).not.toHaveProperty("documents");expect(mocks.plain).not.toHaveBeenCalled();
});
it("sin archivos conserva el guardado anterior",async()=>{
 const form=new FormData();form.append("documents",new File([],""));await saveVehicleAction({error:"",success:""},form);expect(mocks.plain).toHaveBeenCalledOnce();expect(mocks.documents).not.toHaveBeenCalled();
});
it("fallo conjunto no ejecuta un alta parcial ni comunica éxito",async()=>{
 mocks.documents.mockRejectedValue({code:"23505"});const form=new FormData();form.append("documents",new File(["%PDF-1.7"],"prueba.pdf",{type:"application/pdf"}));expect(await saveVehicleAction({error:"",success:""},form)).toMatchObject({success:"",error:expect.stringContaining("placa")});expect(mocks.plain).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
});
