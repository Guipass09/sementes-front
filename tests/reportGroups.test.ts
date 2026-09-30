import assert from "node:assert/strict";
import test from "node:test";
import { filterReports, groupReportsByPatient } from "../src/features/reports/report-groups.ts";
import type { ReportDetail } from "../src/features/reports/types.ts";

function report(id: number, type: ReportDetail["type"], patientId: number | null, patientName: string, date = "2026-09-01"): ReportDetail {
  return {
    id,
    title: `Documento ${id}`,
    date,
    type,
    patient: { id: patientId, name: patientName },
    patientName,
    createdBy: { id: 1, name: "Profissional", role: "professional" },
    professionalName: "Profissional",
    summary: "",
    content: "",
  };
}

test("groups by patient account and separates the three document categories", () => {
  const reports = [
    report(1, "mensal", 10, "Ana", "2026-08-01"),
    report(2, "trimestral", 10, "Ana", "2026-09-01"),
    report(3, "avaliacao", 10, "Ana"),
    report(4, "evolucao", 10, "Ana"),
    report(5, "mensal", 11, "Bruna"),
  ];
  const groups = groupReportsByPatient(reports);

  assert.deepEqual(groups.map((group) => group.name), ["Ana", "Bruna"]);
  assert.deepEqual(groups[0].sections.relatorio.map((item) => item.id), [2, 1]);
  assert.deepEqual(groups[0].sections.avaliacao.map((item) => item.id), [3]);
  assert.deepEqual(groups[0].sections.evolucao.map((item) => item.id), [4]);
  assert.equal(groups[0].total, 4);
});

test("keeps same-name linked patients separate and groups unlinked reports by name", () => {
  const reports = [
    report(1, "mensal", 10, "Ana"),
    report(2, "mensal", 11, "Ana"),
    report(3, "avaliacao", null, "João"),
    report(4, "evolucao", null, "JOAO"),
    { ...report(5, "mensal", null, ""), isPrivate: true },
  ];
  const groups = groupReportsByPatient(reports);

  assert.equal(groups.filter((group) => group.name === "Ana").length, 2);
  assert.equal(groups.find((group) => group.key === "name:joao")?.total, 2);
  assert.equal(groups.find((group) => group.key === "private")?.name, "No meu perfil");
});

test("search matches accented patient names and document categories", () => {
  const reports = [report(1, "avaliacao", 10, "João"), report(2, "evolucao", 11, "Ana")];

  assert.deepEqual(filterReports(reports, "joao").map((item) => item.id), [1]);
  assert.deepEqual(filterReports(reports, "avaliacoes").map((item) => item.id), [1]);
  assert.deepEqual(filterReports(reports, "evoluções").map((item) => item.id), [2]);
});
