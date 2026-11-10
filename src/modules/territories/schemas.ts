import { z } from "zod";

const source = z.string().trim().max(1000).regex(/^https?:\/\/\S+$/).url();
export const provinceSchema = z.object({
  operation: z.literal("province"),
  name: z.string().trim().min(2).max(100),
  officialCode: z.string().trim().regex(/^(?:[0-9]{1,10})?$/),
  sourceUrl: source,
  confirmed: z.literal("on"),
});
export const linkProvinceSchema = z.object({
  operation: z.literal("link"),
  provinceId: z.uuid(),
  expectedProvinceId: z.union([z.uuid(), z.literal("")]),
  sourceUrl: source,
  confirmed: z.literal("on"),
});
export const territoryMutationSchema = z.discriminatedUnion("operation", [provinceSchema, linkProvinceSchema]);
export type TerritoryMutation = z.infer<typeof territoryMutationSchema>;
