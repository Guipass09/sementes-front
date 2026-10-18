import assert from "node:assert/strict";
import test from "node:test";
import { GAME_DESTINATIONS, isResourceLinkActive, resourceNavigation } from "../src/lib/resource-navigation.ts";
import { newestFirst } from "../src/features/patient-library/recent-content.ts";

test("professional shortcuts open the selected category instead of the hub", () => {
  const { games } = resourceNavigation("/profissional");
  for (const entry of GAME_DESTINATIONS) {
    assert.ok(games.some(link => link.path === `/profissional/jogos/${entry.slug}`));
  }
  assert.equal(new Set(games.map(link => link.path)).size, games.length);
  assert.ok(games.some(link => link.path.endsWith("/boca-3d")));
});

test("clinic navigation preserves the therapist-scoped view", () => {
  const { games } = resourceNavigation("/profissional", { clinic: true });
  assert.ok(games.some(link => link.path === "/profissional/jogos?tipo=memory-v2"));
  assert.ok(games.some(link => link.path === "/profissional/jogos?tipo=card-game"));
  assert.ok(games.some(link => link.path === "/profissional/jogos?tipo=stories"));
});

test("patient shortcuts use assigned-content filters and never management routes", () => {
  const { games, activities } = resourceNavigation("/paciente", { patient: true });
  assert.ok(games.some(link => link.path === "/paciente/jogos?tipo=memoria2"));
  assert.ok(games.some(link => link.path === "/paciente/jogos?recentes=1"));
  assert.ok(activities.some(link => link.path === "/paciente/atividades?status=em_andamento"));
  assert.equal(games.some(link => link.path.includes("/novo") || link.path.includes("/boca-3d")), false);
});

test("selected links respect route boundaries, edit screens, and query filters", () => {
  assert.equal(isResourceLinkActive("/profissional/jogos/memoria", "/profissional/jogos/memoria/42/editar", ""), true);
  assert.equal(isResourceLinkActive("/profissional/jogos/memoria", "/profissional/jogos/memoria2", ""), false);
  assert.equal(isResourceLinkActive("/profissional/jogos", "/profissional/jogos/memoria", ""), false);
  assert.equal(isResourceLinkActive("/paciente/jogos", "/paciente/jogos", "?tipo=fonema"), false);
  assert.equal(isResourceLinkActive("/paciente/jogos?tipo=fonema", "/paciente/jogos", "?tipo=memoria"), false);
  assert.equal(isResourceLinkActive("/paciente/jogos?tipo=fonema", "/paciente/jogos", "?tipo=fonema"), true);
});

test("recent items sort by valid dates without comparing IDs from different game tables", () => {
  const items = [
    { id: 100, date: "2026-10-01T12:00:00Z" },
    { id: 2, date: "2026-10-18T12:00:00Z" },
    { id: 999, date: null },
    { id: 1, date: "invalid" },
  ];
  assert.deepEqual(newestFirst(items, item => item.date).map(item => item.id), [2, 100, 999, 1]);
  assert.deepEqual(items.map(item => item.id), [100, 2, 999, 1]);
  assert.deepEqual(newestFirst([], () => null), []);
});
