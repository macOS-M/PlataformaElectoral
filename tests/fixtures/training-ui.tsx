import { createRoot } from "react-dom/client";
import { TrainingWorkspace } from "../../src/modules/training/workspace";
import { PageHeading } from "../../src/components/page-heading";
import type { TrainingRow } from "../../src/modules/training/repository";

declare global {
  interface Window {
    __trainingSubmissions: { operation: string; data: Record<string, FormDataEntryValue> }[];
    __trainingRejectNext: boolean;
    __trainingSave: (operation: string, form: FormData) => Promise<{ error: string; success: string }>;
  }
}
window.__trainingSubmissions = [];
window.__trainingRejectNext = false;
window.__trainingSave = async (operation, form) => {
  window.__trainingSubmissions.push({ operation, data: Object.fromEntries(form) });
  if (window.__trainingRejectNext) { window.__trainingRejectNext = false; return { error: "No se pudo guardar. Los datos se conservan para corregirlos.", success: "" }; }
  return { error: "", success: operation === "requirement" ? "Requisito guardado; el historial se conservó." : "Estado registrado. No se envió correo." };
};
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function row(n: number, name: string, updates: Partial<TrainingRow> = {}): TrainingRow {
  return { positionId: id(n), name, requirementId: id(n + 100), required: true, scheduledOn: "2020-01-10", revision: 1, assignmentId: id(n + 200), personName: `Responsable de prueba ${n}`, progressId: null, status: null, statusOn: null, ...updates };
}
const rows = [
  row(1, "Coordinación General Cantonal", { required: null, requirementId: null, scheduledOn: null }),
  row(2, "Transporte"),
  row(3, "Electorales", { status: "convocado", progressId: id(303), statusOn: "2020-01-01" }),
  row(4, "Signos externos", { status: "cumplido", progressId: id(304), statusOn: "2020-01-10" }),
  row(5, "Coordinación distrital", { assignmentId: null, personName: null }),
  row(6, "Movimientos sectoriales", { required: false, scheduledOn: null }),
  row(7, "Alimentación", { scheduledOn: null }),
  row(8, "Coordinación Día E", { scheduledOn: "2099-01-01" }),
  row(9, "Redes sociales", { status: "no_asistio", progressId: id(309), statusOn: "2020-01-10" }),
];
const query = new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")!).render(<>
  <PageHeading eyebrow="Preparación del equipo" title="Capacitación por puesto" description="Organizá los requisitos y acompañá el avance de tu equipo, desde la convocatoria hasta la asistencia." />
  <TrainingWorkspace rows={query.has("empty") ? [] : rows} history={query.has("empty") ? [] : [{ positionName: "Signos externos", personName: "Responsable de prueba 4", required: true, scheduledOn: "2020-01-10", revision: 1, status: "cumplido", statusOn: "2020-01-10" }]} canEdit={!query.has("reader") && !query.has("empty")} configured={!query.has("empty")} today="2026-11-07" />
</>);
