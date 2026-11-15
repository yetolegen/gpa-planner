(function (root) {
  const r6 = (n) => Math.round(n * 1e6) / 1e6;

  const PRESETS = {
    us: {
      name: "US 4.0 with +/-",
      round: false,
      rows: [[93, "A", 4], [90, "A-", 3.7], [87, "B+", 3.3], [83, "B", 3], [80, "B-", 2.7], [77, "C+", 2.3], [73, "C", 2], [70, "C-", 1.7], [67, "D+", 1.3], [63, "D", 1], [60, "D-", 0.7], [0, "F", 0]],
    },
    usSimple: {
      name: "US 4.0 plain A-F",
      round: false,
      rows: [[90, "A", 4], [80, "B", 3], [70, "C", 2], [60, "D", 1], [0, "F", 0]],
    },
    aitu: {
      name: "Kazakhstan / AITU 4.0 with +/-",
      round: true,
      rows: [[95, "A", 4], [90, "A-", 3.67], [85, "B+", 3.33], [80, "B", 3], [75, "B-", 2.67], [70, "C+", 2.33], [65, "C", 2], [60, "C-", 1.67], [55, "D+", 1.33], [50, "D", 1], [0, "F", 0]],
    },
  };
  const LETTER = { A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7, "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, "D-": 0.7, F: 0 };

  function normScale(sc) {
    const rows = (sc.rows || []).map((r) => [+r[0], String(r[1]), +r[2]]).filter((r) => r[0] >= 0 && r[1]).sort((a, b) => b[0] - a[0]);
    if (!rows.length || rows[rows.length - 1][0] > 0) rows.push([0, "F", 0]);
    return { name: sc.name || "Custom", round: !!sc.round, rows };
  }
  const maxPts = (sc) => Math.max(...sc.rows.map((r) => r[2]));
  const rd = (p, sc) => (sc.round ? Math.floor(p + 0.5 + 1e-9) : p);
  const band = (p, sc) => sc.rows.find((b) => rd(p, sc) >= b[0] - 1e-9) || sc.rows[sc.rows.length - 1];
  const cutoff = (t, sc) => (t <= 0 ? 0 : sc.round ? t - 0.5 : t);
  const key = (cid, ci, ii) => `${cid}|${ci}|${ii}`;
  const score = (scores, cid, ci, ii) => {
    const v = scores[key(cid, ci, ii)];
    return v === undefined || v === null || v === "" ? null : Math.min(100, Math.max(0, +v));
  };

  function shares(items) {
    const t = items.reduce((a, x) => a + (+x.w || 0), 0);
    return items.map((x) => (t > 0 ? (100 * (+x.w || 0)) / t : 100 / items.length));
  }
  function compStats(course, ci, scores) {
    const items = course.comps[ci].items, sh = shares(items);
    let earned = 0, graded = 0;
    items.forEach((x, i) => {
      const v = score(scores, course.id, ci, i);
      if (v !== null) { earned += (sh[i] * v) / 100; graded += sh[i]; }
    });
    return { earned: r6(earned), graded: r6(graded), rest: r6(100 - graded) };
  }
  function weights(course) {
    const live = course.comps.map((c, i) => (c.items.length ? i : -1)).filter((i) => i >= 0);
    const t = live.reduce((a, i) => a + (+course.comps[i].w || 0), 0);
    const w = course.comps.map(() => 0);
    live.forEach((i) => { w[i] = t > 0 ? (+course.comps[i].w || 0) / t : 1 / live.length; });
    return w;
  }
  function calcCourse(course, scores, sc, goals) {
    const w = weights(course);
    const st = course.comps.map((c, i) => compStats(course, i, scores));
    let earned = 0, rest = 0;
    st.forEach((s, i) => { earned += w[i] * s.earned; rest += w[i] * s.rest; });
    earned = r6(earned);
    rest = r6(rest);
    const graded = r6(100 - rest);
    const need = (T) => {
      const C = cutoff(T, sc);
      return rest > 0 ? ((C - earned) / rest) * 100 : earned >= C - 1e-9 ? 0 : Infinity;
    };
    const reach = sc.rows.slice(0, -1).filter((r) => need(r[0]) <= 100 + 1e-9);
    const best = reach.length ? reach[0][0] : null;
    const g = goals && goals[course.id];
    const goal = reach.some((r) => r[0] === g) ? g : best;
    const fails = course.comps.map((c, i) => !!(c.min && st[i].rest === 0 && st[i].earned < c.min));
    return { st, w, earned, rest, graded, need, reach, best, goal, fails, pace: graded > 0 ? (earned / graded) * 100 : null, final: rest > 0 ? null : earned };
  }

  function summarize(courses, scores, sc, goals, boost) {
    let goal = 0, max = 0, now = 0, imp = 0, cr = 0, crP = 0;
    for (const c of courses) {
      const r = calcCourse(c, scores, sc, goals), k = +c.cr >= 0 ? +c.cr : 3;
      cr += k;
      const fin = r.final !== null ? band(r.final, sc)[2] : null;
      goal += k * (fin ?? (r.goal === null ? 0 : band(r.goal, sc)[2]));
      max += k * (fin ?? (r.best === null ? 0 : band(r.best, sc)[2]));
      if (r.pace !== null) {
        crP += k;
        now += k * band(r.final ?? r.pace, sc)[2];
        imp += k * band(r.final ?? r.earned + (r.rest * Math.min(100, r.pace + boost)) / 100, sc)[2];
      }
    }
    return { goal: cr ? goal / cr : null, max: cr ? max / cr : null, now: crP ? now / crP : null, imp: crP ? imp / crP : null };
  }

  function cgPlan(terms, target, cur, top) {
    const fin = terms.filter((t) => t.g !== null).map((t) => t.g);
    const sum = fin.reduce((a, b) => a + b, 0), k = fin.length, N = terms.length;
    const out = { k, sum, N, now: k ? sum / k : null, ci: terms.findIndex((t) => t.g === null) };
    if (out.ci < 0) return out;
    const L = terms.filter((t, i) => i !== out.ci && t.g === null).length;
    const goalSum = target * N, base = sum + cur;
    out.L = L;
    out.after = (sum + cur) / (k + 1);
    out.a = L > 0 ? (goalSum - base) / L : base >= goalSum - 1e-9 ? 0 : Infinity;
    out.best = (base + top * L) / N;
    out.pass = L > 0 ? out.a <= top + 1e-9 : base >= goalSum - 1e-9;
    out.rows = terms.map((t, i) => {
      if (t.g !== null) return { g: t.g, floor: null, st: "done" };
      if (i === out.ci) return { g: cur, floor: Math.max(0, goalSum - sum - top * L), st: "now" };
      return { g: Math.max(0, (goalSum - base) / L), floor: Math.max(0, goalSum - base - top * (L - 1)), st: "later" };
    });
    return out;
  }

  const KEY = /grad|assess|evaluat|marks?\b|distribution|breakdown|weight|scoring|points?\b|оцен|баллы|оценива/i;
  const LET = "A-Za-z\\u0400-\\u04FF";
  const clean = (s) =>
    s.replace(/[|•·▪●◦]/g, " ").replace(/\.{2,}|_{2,}|-{3,}/g, " ").replace(/\s+/g, " ")
      .replace(new RegExp(`^[\\s\\d.)\\-–—:]+(?=[${LET}])`), "").replace(/[\s:\-–—,;(=]+$/, "").trim();
  const hasLetters = (s) => new RegExp(`[${LET}]`).test(s);
  const round2 = (n) => Math.round(n * 100) / 100;

  function candidates(lines) {
    const out = [];
    lines.forEach((raw, idx) => {
      const line = raw.replace(/\t+/g, " | ");
      const ms = [...line.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:%|percent\b|per\s*cent\b)/gi)];
      let prev = 0;
      ms.forEach((m, k) => {
        const before = line.slice(prev, m.index);
        const after = line.slice(m.index + m[0].length, k + 1 < ms.length ? ms[k + 1].index : line.length);
        let w = +m[1].replace(",", "."), n = 1, label;
        const times = before.match(/(\d+)\s*[x×*]\s*$/i);
        if (times) { n = +times[1]; w *= n; label = clean(before.slice(0, times.index)); }
        else label = clean(before);
        if (!label) label = clean(after.replace(/^\s*[=\-–—:|]\s*/, ""));
        if (!label && k === 0 && idx > 0 && !/%/.test(lines[idx - 1])) label = clean(lines[idx - 1].replace(/\t+/g, " "));
        const lead = label.match(new RegExp(`^(\\d{1,2})\\s+(?=[${LET}])`));
        if (lead && n === 1) { n = +lead[1]; label = clean(label.slice(lead[0].length)); if (/\b(each|per)\b/i.test(after)) w *= n; }
        prev = m.index + m[0].length;
        if (!hasLetters(label) || /^(total|overall|sum|grand|итого|всего)/i.test(label) || w <= 0 || w >= 100) return;
        out.push({ label, w: round2(w), n, line: idx });
      });
    });
    return out;
  }

  function pickWindow(cs, lines) {
    const keys = lines.map((l, i) => (KEY.test(l) ? i : -1)).filter((i) => i >= 0);
    let best = null;
    for (let i = 0; i < cs.length; i++) {
      let s = 0;
      for (let j = i; j < cs.length && j - i < 14; j++) {
        s += cs[j].w;
        if (s > 100.5) break;
        if (j > i && Math.abs(s - 100) <= 0.5) {
          const d = keys.length ? Math.min(...keys.map((k) => Math.abs(cs[i].line - k))) : 999;
          if (!best || d < best.d || (d === best.d && j - i > best.j - best.i)) best = { i, j, d };
        }
      }
    }
    return best ? cs.slice(best.i, best.j + 1) : null;
  }

  const mkComp = (label, w, n) => ({
    n: label,
    w,
    items: n > 1 ? Array.from({ length: n }, (_, k) => ({ n: `${label} ${k + 1}`, w: round2(100 / n) })) : [{ n: label, w: 100 }],
  });

  function parseScale(lines) {
    const re = /\b([A-F][+-]?)\b\s*[:=\-–—]?\s*\(?(\d{1,3}(?:\.\d+)?)\s*%?\s*(?:-|–|—|to)\s*(\d{1,3}(?:\.\d+)?)\s*%?\)?(?:\s*[:=\-–—|]?\s*(\d(?:\.\d{1,2})?)\b)?/;
    const seen = new Map();
    for (const l of lines) {
      const m = l.replace(/\t+/g, " ").match(re);
      if (!m) continue;
      const lo = Math.min(+m[2], +m[3]), hi = Math.max(+m[2], +m[3]);
      if (hi > 100 || hi - lo < 1) continue;
      const pts = m[4] !== undefined && +m[4] <= 4.5 ? +m[4] : LETTER[m[1]];
      if (pts !== undefined && !seen.has(m[1])) seen.set(m[1], [lo, m[1], pts]);
    }
    if (seen.size < 4) return null;
    return normScale({ name: "From syllabus", round: false, rows: [...seen.values()] });
  }

  function parseSyllabus(text, fallbackName) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const cs = candidates(lines);
    const win = pickWindow(cs, lines);
    const used = win || cs.slice(0, 12);
    const cr = text.match(/(\d+(?:\.\d)?)\s*(?:credits?|ECTS|cr\b)/i) || text.match(/credits?\s*[:=]?\s*(\d+(?:\.\d)?)/i);
    const title = (lines.find((l) => l.length > 3 && l.length < 90 && hasLetters(l) && !/%/.test(l)) || "").replace(/^(course|subject|title|syllabus)\s*[:\-–—]\s*/i, "");
    return {
      name: fallbackName || title || "New course",
      cr: cr ? +cr[1] : 3,
      comps: used.map((c) => mkComp(c.label, c.w, c.n)),
      sum: round2(used.reduce((a, c) => a + c.w, 0)),
      exact: !!win,
      scale: parseScale(lines),
    };
  }

  const toNum = (s) => {
    if (s === undefined || s === null) return null;
    const m = String(s).replace(/\s/g, "").replace(",", ".").match(/^-?\d+(?:\.\d+)?/);
    return m ? +m[0] : null;
  };
  function textRows(text) {
    const rows = [];
    for (const raw of text.split(/\r?\n/)) {
      const cells = raw.split(/\t| {2,}/).map((c) => c.trim());
      if (cells.length < 3 || !cells[0] || /^grade item$/i.test(cells[0])) continue;
      const rest = cells.slice(1).filter(Boolean);
      const pcts = rest.filter((c) => /%\s*$/.test(c));
      const range = rest.find((c) => /^-?\d+(?:[.,]\d+)?\s*[–-]\s*\d+/.test(c));
      const gradeCell = rest.find((c) => c !== range && /^-?\d+(?:[.,]\d+)?$/.test(c));
      let weight = null, pct = null;
      if (pcts.length >= 2) { weight = pcts[0]; pct = pcts[1]; }
      else if (pcts.length === 1) { if (gradeCell !== undefined) pct = pcts[0]; else weight = pcts[0]; }
      rows.push({ name: cells[0].replace(/^[\s\u00a0]+/, ""), depth: 0, kind: "item", weight, grade: gradeCell ?? "", range: range ?? "", pct: pct ?? "" });
    }
    return rows;
  }
  function parseMoodle(input) {
    let rows = null;
    try { const j = JSON.parse(input); if (j && j.moodle && Array.isArray(j.rows)) rows = j.rows; } catch (e) { rows = null; }
    if (!rows) rows = textRows(input);
    const norm = rows.map((r) => {
      const grade = toNum(r.grade), rangeM = String(r.range || "").match(/(-?\d+(?:[.,]\d+)?)\s*[–-]\s*(-?\d+(?:[.,]\d+)?)/);
      const max = rangeM ? toNum(rangeM[2]) : null;
      let pct = toNum(r.pct);
      if (pct === null && grade !== null && max) pct = (grade / max) * 100;
      let kind = r.kind || "item";
      if (/^course total$/i.test(r.name)) kind = "total";
      else if (/\btotal$/i.test(r.name) && kind === "item") kind = "categoryitem";
      return { name: r.name, depth: +r.depth || 0, kind, weight: toNum(r.weight), pct: pct === null ? null : Math.min(100, Math.max(0, pct)) };
    });
    const comps = [], scores = {};
    let cat = null;
    for (const r of norm) {
      if (r.kind === "total") continue;
      if (r.kind === "categoryitem") {
        if (cat && r.weight !== null && !cat.w) cat.w = r.weight;
        cat = null;
        continue;
      }
      if (r.kind === "category") { cat = { n: r.name, w: r.weight || 0, items: [], depth: r.depth }; comps.push(cat); continue; }
      if (cat && r.depth > cat.depth) {
        cat.items.push({ n: r.name, w: r.weight || 0 });
        if (r.pct !== null) scores[`${comps.length - 1}|${cat.items.length - 1}`] = r.pct;
        continue;
      }
      cat = null;
      comps.push({ n: r.name, w: r.weight || 0, items: [{ n: r.name, w: 100 }] });
      if (r.pct !== null) scores[`${comps.length - 1}|0`] = r.pct;
    }
    comps.forEach((c) => {
      if (c.items.length > 1 || (c.items.length === 1 && c.items[0].w !== 100)) {
        const t = c.items.reduce((a, x) => a + x.w, 0);
        if (!c.w) c.w = round2(t);
        if (!t) c.items.forEach((x) => (x.w = 100));
      }
      delete c.depth;
    });
    const known = comps.reduce((a, c) => a + (c.w || 0), 0);
    if (known === 0 && comps.length) comps.forEach((c) => (c.w = round2(100 / comps.length)));
    return { name: "Moodle course", cr: 3, comps, scores, count: norm.filter((r) => r.kind === "item" || r.kind === "category").length };
  }

  const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff ]+/g, " ").split(/\s+/).filter(Boolean);
  function similarity(a, b) {
    const A = tokens(a), B = tokens(b);
    if (!A.length || !B.length) return 0;
    if (A.join(" ") === B.join(" ")) return 1;
    return A.filter((t) => B.includes(t)).length / Math.max(A.length, B.length);
  }
  function fillScores(course, scores, draft) {
    let filled = 0;
    const unmatched = [], taken = new Set();
    draft.comps.forEach((dc, dci) => {
      dc.items.forEach((di, dii) => {
        const v = draft.scores[`${dci}|${dii}`];
        if (v === undefined) return;
        let best = null, bs = 0;
        course.comps.forEach((c, ci) => c.items.forEach((x, ii) => {
          if (taken.has(`${ci}|${ii}`)) return;
          const s = Math.max(similarity(di.n, x.n), similarity(di.n, `${c.n} ${x.n}`) * 0.9, c.items.length === 1 ? similarity(di.n, c.n) : 0);
          if (s > bs) { bs = s; best = [ci, ii]; }
        }));
        if (best && bs >= 0.5) { scores[key(course.id, best[0], best[1])] = v; taken.add(best.join("|")); filled++; }
        else unmatched.push(di.n);
      });
    });
    return { filled, unmatched };
  }

  function migrateV1(s) {
    const W = { mid: 30, end: 30, fin: 40, ...(s.W || {}) };
    const scores = {}, old = s.scores || {};
    const courses = (s.courses || []).map((c) => {
      const comps = [], map = {};
      if (c.mid && c.mid.length) { map.mid = comps.length; comps.push({ n: "RegMid", w: W.mid, items: c.mid.map((x) => ({ n: x.n, w: x.w })), min: c.minAtt }); }
      if (c.end && c.end.length) { map.end = comps.length; comps.push({ n: "RegEnd", w: W.end, items: c.end.map((x) => ({ n: x.n, w: x.w })), min: c.minAtt }); }
      map.fin = comps.length;
      comps.push({ n: "Final", w: W.fin, items: [{ n: "Final", w: 100 }] });
      for (const part of ["mid", "end"]) (c[part] || []).forEach((_, i) => {
        const v = old[`${c.id}.${part}.${i}`] ?? old[`${c.id}|${part}|${i}`];
        if (v !== undefined && v !== null && v !== "") scores[key(c.id, map[part], i)] = v;
      });
      const f = old[`${c.id}.final`] ?? old[`${c.id}|final`];
      if (f !== undefined && f !== null && f !== "") scores[key(c.id, map.fin, 0)] = f;
      return { id: c.id, name: c.name, cr: c.cr ?? 5, comps };
    });
    const terms = s.cg && Array.isArray(s.cg.terms) ? s.cg.terms : [];
    return {
      scale: PRESETS.aitu,
      courses,
      scores,
      goals: s.goals || {},
      cg: { terms: terms.map((t) => ({ g: t.g === null || t.g === undefined || t.g === "" ? null : +t.g, r: !!t.r })), target: (s.cg && s.cg.target) || 3.5, boost: (s.cg && s.cg.boost) || 5, perYear: 3, years: 3 },
      savedAt: s.savedAt || 0,
    };
  }

  function wsRows(json) {
    const g = json && json.usergrades && json.usergrades[0];
    if (!g) return [];
    const items = g.gradeitems || [];
    const root = items.find((i) => i.itemtype === "course");
    const rootCat = root ? root.iteminstance : null;
    const row = (i, kind, depth, name) => ({
      name: name || i.itemname || "Item", depth, kind,
      weight: i.weightformatted || (i.weightraw !== null && i.weightraw !== undefined ? `${i.weightraw} %` : ""),
      grade: i.gradeformatted !== undefined && i.gradeformatted !== null ? String(i.gradeformatted) : i.graderaw !== null && i.graderaw !== undefined ? String(i.graderaw) : "",
      range: i.rangeformatted || `${i.grademin ?? 0}–${i.grademax ?? 100}`,
      pct: i.percentageformatted || "",
    });
    const leaf = (i) => i.itemtype === "mod" || i.itemtype === "manual";
    const rows = [];
    for (const i of items) {
      if (leaf(i) && (i.categoryid === rootCat || rootCat === null || i.categoryid === undefined)) rows.push(row(i, "item", 1));
      else if (i.itemtype === "category" && i.iteminstance !== rootCat) {
        rows.push(row(i, "category", 1, (i.itemname || "Category " + i.iteminstance).replace(/\s*total$/i, "")));
        for (const k of items) if (leaf(k) && k.categoryid === i.iteminstance) rows.push(row(k, "item", 2));
      }
    }
    return rows;
  }

  function moodleReportUrl(input) {
    let u;
    try { u = new URL(String(input || "").trim()); } catch (e) { return null; }
    const id = u.searchParams.get("id") || u.searchParams.get("courseid");
    if (!id || !/^\d+$/.test(id)) return null;
    const base = u.pathname.replace(/\/(grade|course|my|mod|user|report)\/.*$/, "").replace(/\/$/, "");
    return `${u.origin}${base}/grade/report/user/index.php?id=${id}`;
  }

  const api = { wsRows, moodleReportUrl, PRESETS, normScale, maxPts, rd, band, cutoff, key, score, calcCourse, summarize, cgPlan, parseSyllabus, parseMoodle, fillScores, migrateV1, candidates, parseScale, similarity, round2, mkComp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GPA = api;
})(typeof self !== "undefined" ? self : this);
