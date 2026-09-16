import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadPlanner() {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join("\n");
  assert.ok(script, "the planner script exists");
  const nodes = {};
  const node = () => ({ value: "", innerHTML: "", textContent: "", style: {}, addEventListener() {}, insertAdjacentHTML() {} });
  globalThis.document = { querySelector: (s) => nodes[s] ??= node(), querySelectorAll: () => [node(), node()], getElementById: (s) => nodes[`#${s}`] ??= node(), createElement: () => ({ click() {} }) };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.confirm = () => true;
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });
  return new Function(`${script};return {active,restorePlan,getState:()=>state,setState:(value)=>state=value}`)();
}

test("shows long-lead planning tasks six weeks out", async () => {
  const app = await loadPlanner();
  app.setState({ date: "2099-12-31", type: "solo", checked: {}, custom: [] });
  const names = app.active().map((task) => task[1]);
  assert.ok(names.includes("Choose mover or truck"));
  assert.ok(names.includes("Set a moving budget"));
});

test("adds address and packing tasks as moving day approaches", async () => {
  const app = await loadPlanner();
  const near = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
  app.setState({ date: near, type: "family", checked: {}, custom: [] });
  const names = app.active().map((task) => task[1]);
  assert.ok(names.includes("Forward mail"));
  assert.ok(names.includes("Pack open-first box"));
  assert.ok(names.includes("Tell school, work, and care providers"));
});

test("keeps school-specific task out of a solo move", async () => {
  const app = await loadPlanner();
  const near = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
  app.setState({ date: near, type: "solo", checked: {}, custom: [] });
  assert.ok(!app.active().some((task) => task[1].includes("school")));
});

test("adds travel tasks only for a long-distance move", async () => {
  const app = await loadPlanner();
  const near = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
  app.setState({ date: near, type: "long", checked: {}, custom: [] });
  assert.ok(app.active().some((task) => task[1].includes("documents and chargers")));
});

test("restores only a valid local backup", async () => {
  const app = await loadPlanner();
  const valid = { app: "move-light", version: 1, state: { date: "2099-01-01", type: "solo", checked: {}, custom: ["Book elevator"] } };
  assert.equal(app.restorePlan(valid).custom[0], "Book elevator");
  assert.throws(() => app.restorePlan({ app: "move-light", version: 1, state: {} }));
});

test("keeps personal moving tasks in the active plan", async () => {
  const app = await loadPlanner();
  app.setState({ date: "2099-01-01", type: "solo", checked: {}, custom: ["Reserve building elevator"] });
  assert.ok(app.active().some((task) => task[1] === "Reserve building elevator"));
});
