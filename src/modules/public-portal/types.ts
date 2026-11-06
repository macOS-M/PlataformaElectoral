export type PublicCanton = {
  id: string;
  name: string;
  districts: { id: string; name: string }[];
};
export type TerritoryQuery = { canton?: string | string[]; district?: string | string[] };
