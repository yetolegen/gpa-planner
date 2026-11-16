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

test("moodle: pasted table, bookmarklet json, score fill", () => {
  const txt = ["Grade item\tCalculated weight\tGrade\tRange\tPercentage\tFeedback\tContribution to course total",
    "Assignment 1\t10.00 %\t85.00\t0–100\t85.00 %\t\t8.50 %", "Midterm\t30.00 %\t72.00\t0–100\t72.00 %\t\t21.60 %",
    "Final\t60.00 %\t-\t0–100\t-\t\t-", "Course total\t-\t-\t0–100\t-\t\t-"].join("\n");
  const m = G.parseMoodle(txt);
  assert.deepStrictEqual(m.comps.map((c) => [c.n, c.w]), [["Assignment 1", 10], ["Midterm", 30], ["Final", 60]]);
  assert.deepStrictEqual(m.scores, { "0|0": 85, "1|0": 72 });
  const course = { id: "c1", comps: [{ n: "Assignments", w: 20, items: [{ n: "Assignment 1", w: 50 }, { n: "Assignment 2", w: 50 }] }, { n: "Midterm", w: 30, items: [{ n: "Midterm", w: 100 }] }, { n: "Final", w: 50, items: [{ n: "Final", w: 100 }] }] };
  const scores = {};
  assert.strictEqual(G.fillScores(course, scores, m).filled, 2);
  assert.deepStrictEqual(scores, { "c1|0|0": 85, "c1|1|0": 72 });
  const j = G.parseMoodle(JSON.stringify({ moodle: 1, rows: [
    { name: "Homework", depth: 1, kind: "category", weight: "40.00 %" },
    { name: "HW 1", depth: 2, kind: "item", weight: "20.00 %", grade: "90", range: "0–100", pct: "90.00 %" },
    { name: "HW 2", depth: 2, kind: "item", weight: "20.00 %", grade: "-", range: "0–100", pct: "-" },
    { name: "Homework total", depth: 2, kind: "categoryitem", weight: "" },
    { name: "Exam", depth: 1, kind: "item", weight: "60.00 %", grade: "70", range: "0–100", pct: "70.00 %" },
    { name: "Course total", depth: 0, kind: "total" }] }));
  assert.deepStrictEqual(j.comps.map((c) => [c.n, c.w, c.items.length]), [["Homework", 40, 2], ["Exam", 60, 1]]);
  assert.deepStrictEqual(j.scores, { "0|0": 90, "1|0": 70 });
});

test("moodle web service answer becomes course structure and scores", () => {
  const ws = { usergrades: [{ gradeitems: [
    { itemname: "HW 1", itemtype: "mod", iteminstance: 1, categoryid: 20, weightformatted: "20.00 %", gradeformatted: "90.00", grademin: 0, grademax: 100, percentageformatted: "90.00 %" },
    { itemname: "HW 2", itemtype: "mod", iteminstance: 2, categoryid: 20, weightformatted: "20.00 %", gradeformatted: "-", grademin: 0, grademax: 100, percentageformatted: "-" },
    { itemname: "Homework total", itemtype: "category", iteminstance: 20, weightformatted: "40.00 %" },
    { itemname: "Exam", itemtype: "mod", iteminstance: 3, categoryid: 10, weightformatted: "60.00 %", gradeformatted: "70.00", grademin: 0, grademax: 100, percentageformatted: "70.00 %" },
    { itemtype: "course", iteminstance: 10 }] }] };
  const d = G.parseMoodle(JSON.stringify({ moodle: 1, rows: G.wsRows(ws) }));
  assert.deepStrictEqual(d.comps.map((c) => [c.n, c.w, c.items.length]), [["Homework", 40, 2], ["Exam", 60, 1]]);
  assert.deepStrictEqual(d.scores, { "0|0": 90, "1|0": 70 });
});

test("moodle link becomes the grades report link", () => {
  assert.strictEqual(G.moodleReportUrl("https://moodle.example.edu/course/view.php?id=42"), "https://moodle.example.edu/grade/report/user/index.php?id=42");
  assert.strictEqual(G.moodleReportUrl("https://x.edu/moodle/grade/report/user/index.php?id=9&userid=3"), "https://x.edu/moodle/grade/report/user/index.php?id=9");
  assert.strictEqual(G.moodleReportUrl("https://x.edu/my/"), null);
  assert.strictEqual(G.moodleReportUrl("not a url"), null);
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
