import "server-only";
import { z } from "zod";
import { getAccessContext } from "@/server/authorization/context";
import { canUseInventory } from "./policy";
import { readReceipt } from "./receipt-repository";
export async function getInventoryReceipt(id:string){
 const scope=await getAccessContext();if(!scope||!canUseInventory(scope)||!z.guid().safeParse(id).success)return null;
 return readReceipt(scope,id);
}
