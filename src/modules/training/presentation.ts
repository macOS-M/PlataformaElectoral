import type { TrainingRow } from "./repository";

export const trainingLabels: Record<string, string> = { pendiente: "Pendiente", convocado: "Convocado", cumplido: "Cumplido", no_asistio: "No asistió" };
export function trainingState(row: TrainingRow) {
  if (row.required === null) return "unconfigured";
  if (!row.required) return "optional";
  if (!row.assignmentId) return "vacant";
  return row.status ?? "pendiente";
}
export function formatTrainingDate(date: string | null) {
  if (!date) return "Sin fecha programada";
  return new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
