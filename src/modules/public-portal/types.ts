export type PublicCanton = {
  id: string;
  name: string;
  province?: { id: string; name: string } | null;
  districts: { id: string; name: string }[];
};
export type TerritoryQuery = { province?: string | string[]; canton?: string | string[]; district?: string | string[] };
