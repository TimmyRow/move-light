import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadPlanner() {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "the planner script exists");
  const nodes = {};
  const node = () => ({ value: "", innerHTML: "", textContent: "", style: {}, addEventListener() {} });
  globalThis.document = { querySelector: (s) => nodes[s] ??= node() };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.confirm = () => true;
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });
  return new Function(`${script};return {active,getState:()=>state,setState:(value)=>state=value}`)();
}

test("shows long-lead planning tasks six weeks out", async () => {
  const app = await loadPlanner();
  app.setState({ date: "2099-12-31", type: "solo", checked: {} });
  const names = app.active().map((task) => task[1]);
  assert.ok(names.includes("Choose mover or truck"));
  assert.ok(names.includes("Set a moving budget"));
});

test("adds address and packing tasks as moving day approaches", async () => {
  const app = await loadPlanner();
  const near = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
  app.setState({ date: near, type: "family", checked: {} });
  const names = app.active().map((task) => task[1]);
  assert.ok(names.includes("Forward mail"));
  assert.ok(names.includes("Pack open-first box"));
  assert.ok(names.includes("Tell school, work, and care providers"));
});

test("keeps school-specific task out of a solo move", async () => {
  const app = await loadPlanner();
  const near = new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10);
  app.setState({ date: near, type: "solo", checked: {} });
  assert.ok(!app.active().some((task) => task[1].includes("school")));
});
