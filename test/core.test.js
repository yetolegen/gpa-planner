const test = require("node:test");
const assert = require("node:assert");
const G = require("../core.js");

const us = G.normScale(G.PRESETS.us);
const aitu = G.normScale(G.PRESETS.aitu);

test("needed score and rounding", () => {
  const course = { id: "c", name: "X", cr: 3, comps: [{ n: "Midterm", w: 50, items: [{ n: "Midterm", w: 100 }] }, { n: "Final", w: 50, items: [{ n: "Final", w: 100 }] }] };
  const r = G.calcCourse(course, { "c|0|0": 80 }, us, {});
  assert.strictEqual(r.best, 90);
  assert.strictEqual(Math.ceil(r.need(90)), 100);
  assert.ok(r.need(93) > 100);
  assert.strictEqual(G.band(94.5, aitu)[1], "A");
  assert.strictEqual(G.band(94.4, aitu)[1], "A-");
});

test("syllabus: grading table and scale", () => {
  const txt = ["Course: Operating Systems", "3 credits", "Assessment and grading", "Assignments  5 x 4%", "Quizzes 10%", "Midterm exam 30%", "Final exam 40%", "Total 100%",
    "Grade scale", "A 90-100 4.0", "B 80-89 3.0", "C 70-79 2.0", "D 60-69 1.0", "F 0-59 0"].join("\n");
  const s = G.parseSyllabus(txt);
  assert.deepStrictEqual(s.comps.map((c) => c.n), ["Assignments", "Quizzes", "Midterm exam", "Final exam"]);
  assert.strictEqual(s.comps[0].items.length, 5);
  assert.strictEqual(s.comps[0].w, 20);
  assert.ok(s.exact && s.sum === 100 && s.cr === 3);
  assert.deepStrictEqual(s.scale.rows.map((r) => r[0]), [90, 80, 70, 60, 0]);
});

test("old backup migrates; term plan", () => {
  const old = { courses: [{ id: "os", name: "OS", cr: 5, mid: [{ n: "A1", w: 50 }, { n: "Mid", w: 50 }], end: [{ n: "E", w: 100 }] }], scores: { "os.mid.0": 90, "os.final": 80 }, W: { mid: 30, end: 30, fin: 40 }, cg: { terms: [{ g: 3.5, r: false }], target: 3.7 } };
  const m = G.migrateV1(old);
  assert.deepStrictEqual(m.courses[0].comps.map((c) => c.n), ["RegMid", "RegEnd", "Final"]);
  assert.deepStrictEqual(m.scores, { "os|0|0": 90, "os|2|0": 80 });
  const p = G.cgPlan([{ g: 3.5 }, { g: null }, { g: null }], 3.5, 3.5, 4);
  assert.strictEqual(p.a, 3.5);
  assert.ok(p.pass);
});

test("hand-set total overrides course grade", () => {
  const c = { id: "x", cr: 3, over: 85, comps: [G.mkComp("Final", 100, 1)] };
  const r = G.calcCourse(c, {}, G.PRESETS.us, {});
  assert.strictEqual(r.final, 85);
  assert.strictEqual(G.summarize([c], {}, G.PRESETS.us, {}, 0).now, 3);
});
