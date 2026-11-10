import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({config:vi.fn(),auth:vi.fn(),scope:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@supabase/ssr",()=>({createServerClient:mocks.auth}));
vi.mock("@/server/config",()=>({getConfiguration:mocks.config}));
vi.mock("@/modules/public-transport/service",()=>({getPublicTransportScope:mocks.scope,scopeKey:()=>"scope-sintetico"}));
import { proxy } from "@/proxy";
import { GET } from "@/app/servicios/transporte/token/route";
import { transportCookie,verifyTransportToken } from "@/modules/public-transport/security";
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("AUTH_IDENTIFIER_SECRET","synthetic-secret-with-at-least-32-characters");vi.stubEnv("APP_SITE_URL","https://example.test");mocks.scope.mockReturnValue({organizationId:"scope"});mocks.config.mockReturnValue({NEXT_PUBLIC_SUPABASE_URL:"https://example.test",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"public-test-key"});mocks.auth.mockImplementation(()=>{throw new Error("Auth privado invocado");});});
afterEach(()=>vi.unstubAllEnvs());
it.each(["/servicios","/servicios/transporte","/servicios/transporte/participar","/servicios/transporte/solicitar","/servicios/transporte/token"])("no acopla %s a Supabase Auth",async path=>{const response=await proxy(new NextRequest(`https://example.test${path}`));expect(response.headers.get("Cache-Control")).toContain("no-store");expect(mocks.auth).not.toHaveBeenCalled();});
it("conserva Auth para transporte privado",async()=>{await expect(proxy(new NextRequest("https://example.test/transporte/operacion"))).rejects.toThrow("Auth privado invocado");expect(mocks.auth).toHaveBeenCalledTimes(1);});
it("emite token ligado a cookie HttpOnly, segura, SameSite y sin caché",async()=>{
 const response=await GET(new NextRequest("https://example.test/servicios/transporte/token?kind=passenger",{headers:{origin:"https://example.test"}}));
 const {token}=await response.json();const cookie=response.cookies.get(transportCookie);expect(cookie).toMatchObject({httpOnly:true,secure:true,sameSite:"strict"});expect(response.headers.get("Cache-Control")).toContain("no-store");expect(verifyTransportToken(token,cookie?.value,"scope-sintetico","passenger",Date.now()+3000).id).toBeTruthy();
});
it("rechaza origen ajeno, tipo inválido y configuración ausente",async()=>{
 expect((await GET(new NextRequest("https://example.test/servicios/transporte/token?kind=driver",{headers:{origin:"https://otro.test"}}))).status).toBe(400);
 expect((await GET(new NextRequest("https://example.test/servicios/transporte/token?kind=invalid"))).status).toBe(400);
 vi.stubEnv("AUTH_IDENTIFIER_SECRET","");expect((await GET(new NextRequest("https://example.test/servicios/transporte/token?kind=driver"))).status).toBe(503);
});
it("en producción exige cookie segura incluso si el origen configurado es HTTP",async()=>{
 vi.stubEnv("NODE_ENV","production");vi.stubEnv("APP_SITE_URL","http://example.test");
 const response=await GET(new NextRequest("https://example.test/servicios/transporte/token?kind=driver"));expect(response.cookies.get(transportCookie)?.secure).toBe(true);
});
