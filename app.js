"use strict";
(() => {
  const G = window.GPA;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const f2 = (n) => n.toFixed(2);
  const uid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const hm = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STORE = "gpa-planner-v2", THEME_KEY = "gpa-theme", LANG_KEY = "gpa-ocr-lang";
  const svg = (d) => `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    plus: svg('<path d="M8 3v10M3 8h10"/>'),
    up: svg('<path d="M8 10V2m0 0L5 5m3-3l3 3M3 13h10"/>'),
    down: svg('<path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10"/>'),
    sliders: svg('<path d="M2 5h7m3 0h2M2 11h2m3 0h7"/><circle cx="10.5" cy="5" r="1.5"/><circle cx="5.5" cy="11" r="1.5"/>'),
    search: svg('<circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/>'),
  };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  const nums = new Map();
  function roll(el, to) {
    const from = nums.get(el);
    nums.set(el, to);
    cancelAnimationFrame(el._r);
    if (to === null || from === undefined || from === null || reduce || from === to) { el.textContent = to === null ? "–" : to.toFixed(2); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 420);
      el.textContent = (from + (to - from) * (1 - Math.pow(1 - k, 3))).toFixed(2);
      if (k < 1) el._r = requestAnimationFrame(step);
    };
    el._r = requestAnimationFrame(step);
  }
  const gpos = new Map();
  function glide(box, key) {
    if (!box) return;
    const on = box.querySelector(".on");
    let ind = box.querySelector(".ind");
    if (!on) { gpos.delete(key); if (ind) ind.remove(); return; }
    if (!ind) { ind = document.createElement("span"); ind.className = "ind"; box.prepend(ind); }
    const now = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
    const prev = gpos.get(key);
    const put = (p) => { ind.style.transform = `translate(${p.x}px, ${p.y}px)`; ind.style.width = p.w + "px"; ind.style.height = p.h + "px"; };
    ind.style.transition = "none";
    put(prev || now);
    if (prev && !reduce) {
      void ind.offsetWidth;
      ind.style.transition = "transform .36s cubic-bezier(.23,1,.32,1)";
    }
    put(now);
    gpos.set(key, now);
  }

  const stdCount = (cg) => cg.terms.filter((t) => !t.r).length;
  function fixTerms(cg) {
    const n = Math.max(1, cg.perYear) * Math.max(1, cg.years);
    for (let s = stdCount(cg); s < n; s++) cg.terms.splice(s, 0, { g: null, r: false });
    for (let i = cg.terms.length - 1; i >= 0 && stdCount(cg) > n; i--) if (!cg.terms[i].r && cg.terms[i].g === null) cg.terms.splice(i, 1);
  }
  const fresh = () => ({ scale: G.PRESETS.us, courses: [], scores: {}, goals: {}, tp: {}, ti: 0, cg: { terms: [], target: 3.5, boost: 5, perYear: 2, years: 4 }, savedAt: 0 });
  function norm(s) {
    const b = fresh();
    const o = { ...b, ...s, cg: { ...b.cg, ...(s.cg || {}) } };
    o.scale = G.normScale(o.scale || b.scale);
    const nc = (cs) => (cs || []).map((c) => ({
      id: c.id || uid(), name: c.name || "Course", cr: c.cr ?? 3, mc: c.mc, sig: c.sig,
      over: c.over === undefined || c.over === null || c.over === "" ? undefined : Math.min(100, Math.max(0, +c.over || 0)),
      comps: (c.comps || []).map((x) => ({ n: x.n, w: +x.w || 0, min: x.min, items: (x.items || []).map((i) => ({ n: i.n, w: +i.w || 0 })) })),
    }));
    o.courses = nc(o.courses);
    o.tp = {};
    for (const [k, d] of Object.entries(s.tp || {})) if (d && Array.isArray(d.courses)) o.tp[k] = { courses: nc(d.courses), scores: d.scores || {}, goals: d.goals || {} };
    o.scores = o.scores || {};
    o.goals = o.goals || {};
    delete o.sync;
    o.cg.perYear = Math.max(1, +o.cg.perYear || 2);
    o.cg.years = Math.max(1, +o.cg.years || 4);
    o.cg.terms = (o.cg.terms || []).map((t) => ({ g: t.g === null || t.g === undefined || t.g === "" ? null : +t.g, r: !!t.r, done: !!t.done }));
    fixTerms(o.cg);
    o.ti = Number.isInteger(s.ti) && s.ti >= 0 && s.ti < o.cg.terms.length ? s.ti : Math.max(0, o.cg.terms.findIndex((t) => t.g === null && !t.r));
    return o;
  }
  function load() {
    try { const v2 = JSON.parse(lsGet(STORE)); if (v2 && v2.courses) return norm(v2); } catch (e) { void e; }
    try { const v1 = JSON.parse(lsGet("gpa-scores")); if (v1 && Array.isArray(v1.courses)) return norm(G.migrateV1(v1)); } catch (e) { void e; }
    return norm({});
  }
  let S = load(), saveT = 0, sel = null;
  const editing = new Set();
  let confirmDel = null, confirmReset = false;
  function status(t, bad) { const s = $("saved"); if (s) { s.textContent = t; s.className = "saved" + (bad ? " fail" : ""); } }
  function flush() {
    saveT = 0;
    const ok = lsSet(STORE, JSON.stringify(S));
    status(ok ? "Saved " + hm() : "Can't save here · use Backup", !ok);
  }
  function save() { S.savedAt = Date.now(); clearTimeout(saveT); saveT = setTimeout(flush, 300); }
  addEventListener("pagehide", () => { if (saveT) flush(); });

  const getTheme = () => lsGet(THEME_KEY) || "auto";
  function applyTheme() {
    const t = getTheme();
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  }
  const show = (p) => (S.scale.round ? G.rd(p, S.scale) : f1(p));
  const bandOf = (p) => G.band(p, S.scale);
  const top = () => G.maxPts(S.scale);
  const cof = (t) => S.courses.find((x) => x.id === (t.closest("[data-id]") || {}).dataset?.id);
  const cur = () => S.courses.find((c) => c.id === sel) || S.courses[0] || null;
  const mkStatus = (r, live, n) => (!live ? null : r.final !== null ? ["Done", "t-ok"] : r.goal === null ? ["Out of reach", "t-no"] : n <= 0 ? ["Secured", "t-ok"] : n >= 90 ? ["Tough", "t-hard"] : ["On track", "t-ok"]);
  const needOf = (r) => (r.goal === null ? null : Math.max(0, Math.ceil(r.need(r.goal) - 1e-9)));

  const hue = (n) => [...n].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  const ini = (n) => n.split(/s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  function renderSide() {
    $("side").innerHTML = `<div class="brand">GPA Planner</div>
      <button class="kbtn" data-go="pal">${ICON.search}<span>Search</span><kbd>Ctrl K</kbd></button>
      <div><div class="sl"><span>Courses</span><span>${S.courses.length}</span></div>
        <div class="nav" id="nav"><span class="hov" id="hov"></span>${S.courses.map((c) => `<button class="ni${c.id === (cur() && cur().id) ? " on" : ""}" data-id="${c.id}"><span class="avw"><i class="av" style="--h:${hue(c.name)}">${esc(ini(c.name))}</i><i class="dotc" id="nd-${c.id}"></i></span><span class="nm">${esc(c.name)}</span><span class="nb" id="nb-${c.id}"></span></button>`).join("")}</div>
        <button class="tl" data-go="add">${ICON.plus}Add course</button></div>
      <div><div class="sl">Tools</div><div class="tools">
        <button class="tl" data-go="import">${ICON.up}Import syllabus or grades</button>
        <button class="tl" data-go="scale">${ICON.sliders}Grading scale</button>
        <button class="tl" data-go="backup">${ICON.down}Backup</button></div></div>
      <div class="sidefoot"><div class="thm seg" id="thm">${["auto", "light", "dark"].map((t) => `<button data-theme="${t}" class="${getTheme() === t ? "on" : ""}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div><span class="saved" id="saved"></span></div>`;
    glide($("thm"), "thm");
    const nav = $("nav"), hov = $("hov");
    nav.addEventListener("mouseover", (e) => {
      const it = e.target.closest(".ni");
      if (!it) return;
      hov.style.opacity = 1;
      hov.style.height = it.offsetHeight + "px";
      hov.style.transform = `translateY(${it.offsetTop}px)`;
    });
    nav.addEventListener("mouseleave", () => { hov.style.opacity = 0; });
    refreshSide();
  }
  function refreshSide() {
    for (const c of S.courses) {
      const r = G.calcCourse(c, S.scores, S.scale, S.goals), live = c.comps.some((x) => x.items.length);
      const st = mkStatus(r, live, needOf(r)), p = r.final ?? r.pace;
      const d = $("nd-" + c.id), b = $("nb-" + c.id);
      if (d) d.className = "dotc " + (st ? st[1] : "");
      if (b) b.textContent = p === null ? "" : bandOf(p)[1];
    }
  }

  function initStrip() {
    $("strip").innerHTML = `<div class="k"><span class="kl">GPA if you hit your goals</span><span class="kv" id="vGoal">–</span></div>
      <div class="k"><span class="kl">Best possible</span><span class="kv" id="vMax">–</span></div>
      <div class="k"><span class="kl">Now</span><span class="kv" id="vNow">–</span></div>
      <div class="k"><label class="kl" for="boost">If you improve <select id="boost">${[3, 5, 10, 15].map((b) => `<option value="${b}">+${b} pts</option>`).join("")}</select></label><span class="kv" id="vImp">–</span></div>`;
  }
  function renderStrip() {
    const x = G.summarize(S.courses, S.scores, S.scale, S.goals, S.cg.boost);
    roll($("vGoal"), x.goal);
    roll($("vMax"), x.max);
    roll($("vNow"), x.now);
    roll($("vImp"), x.imp);
    $("boost").value = S.cg.boost;
    const tm = S.cg.terms[S.ti];
    if (tm && tm.done && x.now !== null) {
      tm.g = G.round2(Math.min(top(), x.now));
      const inp = document.querySelector(`[data-term="${S.ti}"]`);
      if (inp) inp.value = tm.g;
    }
    const oi = S.cg.terms.findIndex((t) => t.g === null && !t.r), d = S.tp[oi];
    refreshCg(oi === S.ti ? (S.courses.length ? x.goal : null) : d && d.courses.length ? G.summarize(d.courses, d.scores, S.scale, d.goals, S.cg.boost).goal : null);
  }
  function renderTbar() {
    const cg = S.cg;
    S.ti = Math.min(S.ti, cg.terms.length - 1);
    const t = cg.terms[S.ti];
    $("tbar").innerHTML = `<label class="kl" for="tsel">Trimester</label><select id="tsel">${cg.terms.map((q, k) => `<option value="${k}"${k === S.ti ? " selected" : ""}>${termName(k)} · ${termYear(k)}${q.g !== null ? " · " + f2(q.g) : ""}${q.done ? " ✓" : ""}</option>`).join("")}</select>${t.done ? '<span class="tg t-ok">Finished</span><button class="link" data-tm="reopen">Reopen</button>' : `<button class="btn" data-tm="finish"${S.courses.length ? "" : " disabled"}>Finish trimester</button>`}`;
  }
  function gotoTerm(i) {
    if (S.courses.length) S.tp[S.ti] = { courses: S.courses, scores: S.scores, goals: S.goals }; else delete S.tp[S.ti];
    const d = S.tp[i] || { courses: [], scores: {}, goals: {} };
    delete S.tp[i];
    S.courses = d.courses; S.scores = d.scores; S.goals = d.goals;
    S.ti = i; sel = null; editing.clear(); confirmDel = null;
    renderAll();
    save();
  }
  function finishTerm() {
    const x = G.summarize(S.courses, S.scores, S.scale, S.goals, 0);
    if (x.now === null) return;
    const t = S.cg.terms[S.ti];
    t.g = G.round2(Math.min(top(), x.now));
    t.done = true;
    const nxt = () => S.cg.terms.findIndex((q, k) => k > S.ti && !q.r && q.g === null);
    if (nxt() < 0) { S.cg.years++; fixTerms(S.cg); }
    gotoTerm(nxt() < 0 ? S.ti : nxt());
  }
  document.addEventListener("change", (e) => { if (e.target.id === "tsel") gotoTerm(+e.target.value); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tm]");
    if (!b) return;
    if (b.dataset.tm === "finish") finishTerm();
    else { S.cg.terms[S.ti].done = false; renderTbar(); renderStrip(); save(); }
  });
  function renderLegend() {
    $("legend").innerHTML = `<span>Scale: <b>${esc(S.scale.name)}</b>${S.scale.round ? ", totals round to whole first" : ""}</span><button class="link" data-go="scale">Change</button>`;
  }

  function itemPct(c, r, ci, ii) {
    const items = c.comps[ci].items, t = items.reduce((a, x) => a + (+x.w || 0), 0);
    return ((t > 0 ? (+items[ii].w || 0) / t : 1 / items.length) * r.w[ci]) * 100;
  }
  const emptyHTML = () => `<div class="empty"><h3>No courses yet</h3><p class="muted" style="margin:0;max-width:56ch">Type grades as they land. See the score you need on everything left.</p>
    <button class="opt" data-go="import">${ICON.up}<div><b>Import syllabus</b><span>PDF, Word, text, or a photo</span></div></button>
    <button class="opt" data-go="add">${ICON.plus}<div><b>Add a course by hand</b><span>Pick components and weights yourself</span></div></button>
    <button class="opt" data-go="example">${ICON.plus}<div><b>Try example courses</b><span>See how it works</span></div></button></div>`;
  function editorHTML(c) {
    return `<div class="ed"><div class="edtop">
      <label for="ed-name">Course name<input id="ed-name" data-ed="name" value="${esc(c.name)}"></label>
      <label for="ed-cr">Credits<input id="ed-cr" data-ed="cr" type="number" min="0" step="any" inputmode="decimal" value="${c.cr ?? 3}"></label>
      <label for="ed-over">Total grade % (recredit)<input id="ed-over" data-ed="over" type="number" min="0" max="100" step="any" inputmode="decimal" placeholder="auto" value="${c.over ?? ""}"></label></div>
      <div class="edcomps">${c.comps.map((comp, ci) => `<div class="edgrp"><div class="edhead">
        <label>Component<input data-ed="cn" data-ci="${ci}" value="${esc(comp.n)}"></label>
        <label>Weight %<input data-ed="cw" data-ci="${ci}" type="number" min="0" step="any" value="${comp.w}"></label>
        <label>Min %<input data-ed="cm" data-ci="${ci}" type="number" min="0" max="100" step="any" placeholder="none" value="${comp.min ?? ""}"></label>
        <button class="x" data-act="rmComp" data-ci="${ci}" aria-label="Remove ${esc(comp.n)}">×</button></div>
        ${comp.items.map((x, ii) => `<div class="edrow"><input data-ed="in" data-ci="${ci}" data-ii="${ii}" value="${esc(x.n)}" aria-label="Item name"><input data-ed="iw" data-ci="${ci}" data-ii="${ii}" type="number" min="0" step="any" value="${x.w}" aria-label="Item points"><button class="x" data-act="rmItem" data-ci="${ci}" data-ii="${ii}" aria-label="Remove ${esc(x.n)}">×</button></div>`).join("")}
        <button class="link" data-act="addItem" data-ci="${ci}">Add item</button></div>`).join("")}</div>
      <p class="foot">Weights scale to 100. Item points scale inside each component. Min % is optional: finish a component under it and you get a warning.</p>
      <div class="actions"><button class="btn" data-act="addComp">Add component</button><button class="link bad" data-act="delCourse">${confirmDel === c.id ? "Click again: delete course and its grades" : "Delete course"}</button></div></div>`;
  }
  function courseHTML(c) {
    const r = G.calcCourse(c, S.scores, S.scale, S.goals);
    const rows = c.comps.map((comp, ci) => (comp.items.length
      ? `<section class="grp"><header class="gh"><span class="gn">${esc(comp.n)}</span><span class="gw">${f1(r.w[ci] * 100)}% of course</span><span class="gs" data-ci="${ci}"></span></header>${comp.items.map((x, ii) => {
        const k = G.key(c.id, ci, ii), v = S.scores[k];
        return `<div class="r2"><i class="dt0" id="d-${k}"></i><span class="nm" title="${esc(x.n)}">${esc(x.n)}</span><span class="wt">${f1(itemPct(c, r, ci, ii))}%</span><input id="i-${k}" data-k="${k}" type="number" min="0" max="100" step="any" inputmode="decimal" value="${v ?? ""}" placeholder="—" aria-label="${esc(x.n)} score"><span class="hint" id="h-${k}"></span></div>`;
      }).join("")}</section>` : "")).join("") || '<p class="muted" style="margin:0">No components yet. Press Edit.</p>';
    return `<article class="ch" id="c-${c.id}" data-id="${c.id}">
      <div class="ct2"><div><h2 class="cvName">${esc(c.name)}</h2><p class="meta cvMeta"></p></div>
        <button class="btn" data-act="toggleEdit">${editing.has(c.id) ? "Done" : "Edit"}</button></div>
      <div class="cvEdit">${editing.has(c.id) ? editorHTML(c) : ""}</div>
      <div class="answer"><div class="goalrow"><span class="kl">Goal grade</span><div class="gstep cvPills"></div></div><div class="need cvGoal"></div></div>
      <div class="meter"><div class="bar2"><i class="mf pos mfP"></i><i class="mf sec mfS"></i><i class="mk2 cvMk" hidden></i></div><div class="mleg cvLeg"></div></div>
      <div class="groups">${rows}</div></article>`;
  }
  let inT = 0;
  function renderCourse() {
    if (!S.courses.length) { $("cv").innerHTML = emptyHTML(); return; }
    $("cv").classList.add("in");
    clearTimeout(inT);
    inT = setTimeout(() => $("cv").classList.remove("in"), 800);
    $("cv").innerHTML = S.courses.map(courseHTML).join("");
    S.courses.forEach(refreshCourse);
  }
  function renderOne(c) {
    const el = $("c-" + c.id);
    if (!el) { renderCourse(); return; }
    el.outerHTML = courseHTML(c);
    refreshCourse(c);
  }
  function refreshCourse(c) {
    const root = c && $("c-" + c.id);
    if (!root) return;
    const q = (x) => root.querySelector(x);
    const r = G.calcCourse(c, S.scores, S.scale, S.goals);
    const live = c.comps.some((x) => x.items.length);
    const n = needOf(r), st = mkStatus(r, live, n);
    q(".cvMeta").innerHTML = [`${c.cr ?? 3} credits`, st ? `<span class="tg ${st[1]}">${st[0]}</span>` : "", r.final !== null ? `Final <b>${show(r.final)}%</b> ${esc(bandOf(r.final)[1])}` : r.pace !== null ? `Now <b>${show(r.pace)}%</b> ${esc(bandOf(r.pace)[1])}` : "", c.over !== undefined ? "Total set by hand" : ""].filter(Boolean).join(" · ");
    const g = q(".cvGoal"), pills = q(".cvPills");
    if (!live) { g.innerHTML = '<span class="sub">Add grading components to see the score you need.</span>'; pills.innerHTML = ""; }
    else if (r.final !== null) { const b = bandOf(r.final); g.innerHTML = `<span class="big">${esc(b[1])}</span><span class="sub">Course done: ${show(r.final)}% · GPA ${f2(b[2])}</span>`; pills.innerHTML = ""; }
    else if (r.goal === null) { g.innerHTML = '<span class="sub fail">Full marks on everything left still misses a pass.</span>'; pills.innerHTML = ""; }
    else {
      const gb = bandOf(r.goal), ix = r.reach.findIndex((q) => q[0] === r.goal);
      g.innerHTML = n <= 0 ? `<span class="big ok">Secured</span><span class="sub">${esc(gb[1])} · GPA ${f2(gb[2])} is locked in</span>` : `<span class="big">${n}</span><span class="sub">needed on every item left for <b>${esc(gb[1])}</b> · GPA ${f2(gb[2])} · course total ${G.cutoff(r.goal, S.scale)}%</span>`;
      const nb = (k, sym, lbl) => { const q = r.reach[ix + k]; return `<button class="x" ${q ? `data-goal="${q[0]}"` : "disabled"} aria-label="${lbl}">${sym}</button>`; };
      pills.innerHTML = nb(-1, "‹", "Higher goal") + `<span class="gl"><b>${esc(gb[1])}</b> ${r.goal === r.best ? "best possible" : f2(gb[2])}</span>` + nb(1, "›", "Lower goal");
    }
    const sec = Math.min(100, r.earned), pos = Math.min(100, r.earned + r.rest);
    q(".mfS").style.transform = `scaleX(${sec / 100})`;
    q(".mfP").style.transform = `scaleX(${pos / 100})`;
    const mk = q(".cvMk"), cut = r.goal === null ? null : G.cutoff(r.goal, S.scale);
    mk.hidden = cut === null || !live;
    if (cut !== null) { mk.style.left = Math.min(100, cut) + "%"; mk.dataset.l = f1(cut); }
    q(".cvLeg").innerHTML = `<span><i class="sw sec"></i>Secured <b>${f1(r.earned)}</b></span><span><i class="sw pos"></i>Still possible <b>${f1(r.rest)}</b></span>` + (cut === null ? "" : `<span>Goal line <b>${f1(cut)}</b></span>`);
    c.comps.forEach((comp, ci) => {
      const s = r.st[ci], gs = q(`.gs[data-ci="${ci}"]`);
      if (gs) gs.innerHTML = s.graded ? `<span${r.fails[ci] ? ' class="fail"' : ""}>${f1(s.earned)} / ${f1(s.graded)}${r.fails[ci] ? ` · under ${comp.min}` : ""}</span>` : "—";
      comp.items.forEach((x, ii) => {
        const k = G.key(c.id, ci, ii), has = G.score(S.scores, c.id, ci, ii) !== null;
        const d = $("d-" + k), h = $("h-" + k);
        if (d) d.classList.toggle("on", has);
        if (!h) return;
        if (has || n === null) h.textContent = "";
        else { h.textContent = n <= 0 ? "any" : "need " + n; h.classList.toggle("hard", n >= 90); }
      });
    });
  }

  let cgAll = false;
  const termNo = (i) => S.cg.terms.slice(0, i + 1).filter((x) => x.r === S.cg.terms[i].r).length;
  const termName = (i) => (S.cg.terms[i].r ? `R${termNo(i)}` : `T${termNo(i)}`);
  const termYear = (i) => (S.cg.terms[i].r ? "retake" : `Y${Math.ceil(termNo(i) / S.cg.perYear)}`);
  function cgSkeleton() {
    const cg = S.cg, T = top();
    const firstOpen = cg.terms.findIndex((t) => t.g === null && !t.r), lastFilled = cg.terms.reduce((m, t, i) => (t.g !== null || t.r ? i : m), -1);
    const shownTo = Math.max(firstOpen < 0 ? 0 : firstOpen, lastFilled), hidden = cg.terms.length - 1 - shownTo;
    const chips = [0.75, 0.875, 0.925, 0.975, 1].map((f) => Math.round(T * f * 100) / 100);
    $("cg").innerHTML = `<div class="cgp"><div class="tgt">
      <div class="tgt-main"><label class="kl" for="cgTarget">Target CGPA</label>
        <div class="stepper"><button id="tgtDown" aria-label="Lower target by 0.05">−</button><input id="cgTarget" type="number" min="0" max="${T}" step="0.05" inputmode="decimal" value="${(+cg.target).toFixed(2)}"><button id="tgtUp" aria-label="Raise target by 0.05">+</button></div>
        <div class="chips seg" id="segT" role="group" aria-label="Quick targets">${chips.map((v) => `<button class="chip${Math.abs(v - cg.target) < 1e-9 ? " on" : ""}" data-tgt="${v}">${v.toFixed(2)}</button>`).join("")}</div></div>
      <div class="tgt-main"><span class="kl">Hit it by end of</span>
        <div class="chips seg" id="segY" role="group" aria-label="Deadline">${[1, 2, 3, 4, 5, 6].map((y) => `<button class="chip${cg.years === y ? " on" : ""}" data-years="${y}">Y${y}</button>`).join("")}</div></div>
      <div class="mini"><label>terms/yr <input id="perYear" type="number" min="1" max="6" value="${cg.perYear}"></label></div></div>
      <p class="tgt-line" id="cgHead"></p>
      <table class="tt"><thead><tr><th>Term</th><th>Year</th><th>GPA</th><th>Plan</th><th></th><th></th><th></th></tr></thead><tbody>${cg.terms.map((t, i) => (!cgAll && i > shownTo ? "" : `<tr><td class="m">${termName(i)}</td><td class="m">${termYear(i)}</td><td class="${t.r ? "dashed" : ""}"><input data-term="${i}" type="number" min="0" max="${T}" step="0.01" inputmode="decimal" placeholder="—" value="${t.g ?? ""}" aria-label="${termName(i)} GPA"></td><td><div class="bar"><i id="pb-${i}"></i></div></td><td class="pv" id="pv-${i}"></td><td id="ps-${i}"></td><td><button class="x" data-rm="${i}" aria-label="Remove ${termName(i)}">×</button></td></tr>`)).join("")}</tbody></table>${hidden ? `<button class="link" data-cg="more">${cgAll ? "Show fewer terms" : `Show ${hidden} more terms`}</button>` : cgAll && cg.terms.length > 3 ? '<button class="link" data-cg="more">Show fewer terms</button>' : ""}
      <div class="actions"><button class="btn" data-cg="retake">Add retake term</button><span class="foot" id="cgNote"></span></div></div>`;
    glide($("segT"), "segT");
    glide($("segY"), "segY");
  }
  const tagFor = (n) => (n <= 0 ? ["already there", "t-ok", ""] : n > top() + 1e-9 ? ["not possible", "t-no", "no"] : n >= top() - 0.15 ? ["tough", "t-hard", "hard"] : ["doable", "t-ok", ""]);
  function refreshCg(cur) {
    if (!$("cgHead")) return;
    const cg = S.cg, T = +cg.target, tp = top();
    const p = G.cgPlan(cg.terms, T, cur ?? 0, tp);
    let head;
    if (cur === null) head = "Add a course to plan this term.";
    else if (p.ci < 0) head = `All terms have a GPA. CGPA <b>${f2(p.now)}</b>, ${p.now >= T - 1e-9 ? "meets" : "under"} ${f2(T)}. Add a term to plan more.`;
    else if (p.L <= 0) head = `After this term CGPA <b>${f2(p.after)}</b>, ${p.after >= T - 1e-9 ? "meets" : "under"} ${f2(T)}.`;
    else if (p.a <= 0) head = `Target ${f2(T)} already secured.`;
    else if (p.a > tp + 1e-9) head = `${f2(T)} out of reach with this term's goals. Best finish <b>${f2(p.best)}</b>.`;
    else head = `To reach ${f2(T)}: about <b>${f2(p.a)}</b> in each of the next ${p.L} terms.`;
    $("cgHead").innerHTML = (p.k ? `Now <b>${f2(p.sum / p.k)}</b> after ${p.k} ${p.k === 1 ? "term" : "terms"}. ` : "") + head;
    cg.terms.forEach((t, i) => {
      const row = p.rows && cur !== null ? p.rows[i] : null;
      let val = t.g, st = ["done", "t-ok", ""];
      if (t.g === null) { val = row ? row.g : null; st = !row ? ["", "", ""] : row.st === "now" ? ["this term", "t-ok", ""] : tagFor(row.g); }
      const bar = $("pb-" + i), pv = $("pv-" + i), ps = $("ps-" + i);
      if (!bar) return;
      bar.style.transform = `scaleX(${val === null ? 0 : Math.min(1, val / tp)})`;
      bar.className = st[2];
      pv.textContent = val === null ? "" : val > tp + 1e-9 ? "over " + f2(tp) : f2(val);
      ps.innerHTML = st[0] ? `<span class="tg ${st[1]}">${st[0]}</span>` : "";
    });
    $("cgNote").textContent = p.ci >= 0 && cur !== null && !p.pass ? "Target not reachable with current goals." : "";
  }

  function renderAll() {
    if (!S.courses.find((c) => c.id === sel)) sel = S.courses[0] ? S.courses[0].id : null;
    renderSide();
    renderTbar();
    renderLegend();
    renderCourse();
    cgSkeleton();
    renderStrip();
    $("foot").textContent = "Course total = weighted average of components. Goal starts at the best grade still possible; pick another to plan for it. Needed scores assume the same score on every item left, rounded up. Courses average by credits. CGPA treats every term as equal. All data stays on this device.";
  }
  const gridOf = (c) => c.comps.map((comp, ci) => comp.items.map((x, ii) => S.scores[G.key(c.id, ci, ii)]));
  function putGrid(c, grid) {
    for (const k of Object.keys(S.scores)) if (k.startsWith(c.id + "|")) delete S.scores[k];
    grid.forEach((row, ci) => row.forEach((v, ii) => { if (v !== undefined && v !== null && v !== "") S.scores[G.key(c.id, ci, ii)] = v; }));
  }
  const newCourse = (name, comps, cr) => { const c = { id: uid(), name, cr: cr ?? 3, comps }; S.courses.push(c); sel = c.id; return c; };
  function markSide() {
    document.querySelectorAll("#nav .ni").forEach((n) => n.classList.toggle("on", n.dataset.id === sel));
  }
  function select(id) {
    sel = id;
    markSide();
    const el = $("c-" + id);
    if (el) el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }
  addEventListener("scroll", () => {
    let best = null;
    for (const c of S.courses) { const el = $("c-" + c.id); if (el && el.getBoundingClientRect().top <= innerHeight * 0.35) best = c.id; }
    if (best && best !== sel) { sel = best; markSide(); }
  }, { passive: true });
  function addByHand() {
    const c = newCourse("New course", [G.mkComp("Assignments", 30, 4), G.mkComp("Midterm exam", 30, 1), G.mkComp("Final exam", 40, 1)]);
    editing.add(c.id);
    renderAll();
    save();
    const nm = $("ed-name");
    if (nm) { nm.scrollIntoView({ block: "center" }); nm.select(); }
  }
  function loadExample() {
    newCourse("Introduction to Programming", [G.mkComp("Assignments", 30, 5), G.mkComp("Midterm exam", 30, 1), G.mkComp("Final exam", 40, 1)], 4);
    newCourse("Calculus I", [G.mkComp("Quizzes", 20, 4), G.mkComp("Midterm exam", 30, 1), G.mkComp("Final exam", 50, 1)], 3);
    sel = S.courses[0].id;
    renderAll();
    save();
  }
  const afterScore = (c) => { refreshCourse(c); refreshSide(); renderStrip(); save(); };

  $("side").addEventListener("click", (e) => {
    const ni = e.target.closest(".ni");
    if (ni) { select(ni.dataset.id); return; }
    const th = e.target.closest("[data-theme]");
    if (th) { lsSet(THEME_KEY, th.dataset.theme); applyTheme(); glideTheme(); }
  });
  function glideTheme() {
    const t = getTheme();
    $("thm").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.theme === t));
    glide($("thm"), "thm");
  }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]")?.dataset.go;
    if (!go) return;
    if (go === "pal") openPal(); else if (go === "add") addByHand(); else if (go === "import") openImport();
    else if (go === "scale") openScale(); else if (go === "backup") openBackup(); else if (go === "example") loadExample();
  });
  $("strip").addEventListener("change", (e) => { if (e.target.id === "boost") { S.cg.boost = +e.target.value; renderStrip(); save(); } });
  $("cv").addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset.k) return;
    S.scores[t.dataset.k] = t.value === "" ? null : +t.value;
    afterScore(cof(t));
  });
  $("cv").addEventListener("keydown", (e) => {
    const t = e.target;
    if (!t.dataset || !t.dataset.k || !["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const all = [...$("cv").querySelectorAll("input[data-k]")], n = all.indexOf(t) + (e.key === "ArrowUp" ? -1 : 1);
    if (all[n]) { e.preventDefault(); all[n].focus(); all[n].select(); }
  });
  $("cv").addEventListener("change", (e) => {
    const t = e.target, ed = t.dataset.ed;
    if (!ed) return;
    const c = cof(t), ci = +t.dataset.ci, ii = +t.dataset.ii;
    if (!c) return;
    if (ed === "name") c.name = t.value.trim() || "Untitled course";
    else if (ed === "cr") c.cr = t.value === "" ? 3 : Math.max(0, +t.value || 0);
    else if (ed === "over") { if (t.value === "") delete c.over; else c.over = Math.min(100, Math.max(0, +t.value || 0)); }
    else if (ed === "cn") c.comps[ci].n = t.value.trim() || "Component";
    else if (ed === "cw") c.comps[ci].w = Math.max(0, +t.value || 0);
    else if (ed === "cm") { if (t.value === "") delete c.comps[ci].min; else c.comps[ci].min = Math.min(100, Math.max(0, +t.value || 0)); }
    else if (ed === "in") c.comps[ci].items[ii].n = t.value.trim() || "Item";
    else if (ed === "iw") c.comps[ci].items[ii].w = Math.max(0, +t.value || 0);
    renderSide();
    renderOne(c);
    renderStrip();
    save();
  });
  $("cv").addEventListener("click", (e) => {
    const c = cof(e.target);
    const g = e.target.closest("[data-goal]");
    if (g && c) { S.goals[c.id] = +g.dataset.goal; refreshCourse(c); renderStrip(); save(); return; }
    const b = e.target.closest("[data-act]");
    if (!b || !c) return;
    const a = b.dataset.act, ci = +b.dataset.ci, ii = +b.dataset.ii;
    if (a === "toggleEdit") { editing.has(c.id) ? editing.delete(c.id) : editing.add(c.id); confirmDel = null; renderOne(c); return; }
    if (a === "addItem") c.comps[ci].items.push({ n: "New item", w: 0 });
    else if (a === "addComp") c.comps.push({ n: "New component", w: 0, items: [{ n: "Item", w: 100 }] });
    else if (a === "rmItem") { const gr = gridOf(c); gr[ci].splice(ii, 1); c.comps[ci].items.splice(ii, 1); putGrid(c, gr); }
    else if (a === "rmComp") { const gr = gridOf(c); gr.splice(ci, 1); c.comps.splice(ci, 1); putGrid(c, gr); }
    else if (a === "delCourse") {
      if (confirmDel !== c.id) { confirmDel = c.id; renderOne(c); return; }
      S.courses = S.courses.filter((x) => x !== c);
      for (const k of Object.keys(S.scores)) if (k.startsWith(c.id + "|")) delete S.scores[k];
      delete S.goals[c.id];
      editing.delete(c.id);
      confirmDel = null;
      sel = null;
      renderAll();
      save();
      return;
    }
    renderOne(c);
    renderSide();
    renderStrip();
    save();
  });

  $("cg").addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "cgTarget") S.cg.target = Math.min(top(), Math.max(0, +t.value || 0));
    else if (t.dataset.term !== undefined) { const q = S.cg.terms[+t.dataset.term]; q.g = t.value === "" ? null : Math.min(top(), Math.max(0, +t.value)); if (q.done) { q.done = false; renderTbar(); } }
    else return;
    renderStrip();
    save();
  });
  function setTarget(v) { S.cg.target = Math.min(top(), Math.max(0, Math.round(v * 100) / 100)); cgSkeleton(); renderStrip(); save(); }
  $("cg").addEventListener("click", (e) => {
    const t = e.target;
    const rm = t.closest("[data-rm]");
    if (rm) {
      const k = +rm.dataset.rm;
      if (k === S.ti || (S.tp[k] && S.tp[k].courses.length)) return;
      S.cg.terms.splice(k, 1);
      const n = {};
      for (const [a, v] of Object.entries(S.tp)) n[+a > k ? +a - 1 : a] = v;
      S.tp = n;
      if (S.ti > k) S.ti--;
      renderTbar();
      cgSkeleton(); renderStrip(); save(); return; }
    if (t.closest("[data-cg=more]")) { cgAll = !cgAll; cgSkeleton(); renderStrip(); return; }
    if (t.closest("[data-cg=retake]")) { S.cg.terms.push({ g: null, r: true }); cgSkeleton(); renderStrip(); save(); return; }
    const yr = t.closest("[data-years]");
    if (yr) { S.cg.years = +yr.dataset.years; fixTerms(S.cg); cgSkeleton(); renderStrip(); save(); return; }
    const chip = t.closest("[data-tgt]");
    if (chip) setTarget(+chip.dataset.tgt);
    else if (t.id === "tgtUp") setTarget(S.cg.target + 0.05);
    else if (t.id === "tgtDown") setTarget(S.cg.target - 0.05);
  });
  $("cg").addEventListener("change", (e) => {
    if (e.target.id !== "perYear") return;
    S.cg.perYear = Math.min(6, Math.max(1, Math.round(+e.target.value) || 2));
    fixTerms(S.cg);
    cgSkeleton();
    renderStrip();
    save();
  });

  const dlg = $("dlg");
  function openDlg(title, html) { $("dlgTitle").textContent = title; $("dlgBody").innerHTML = html; if (!dlg.open) dlg.showModal(); }
  $("dlgX").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  let sy = null, tickT = 0;
  const sumComps = (d) => G.round2(d.comps.reduce((a, c) => a + (+c.w || 0), 0));
  function sylHTML() {
    const s = sy;
    return `<p class="${s.exact ? "ok" : "fail"}" style="margin:0">${s.exact ? "Found a grading table that adds to 100%. Check it, then create." : s.comps.length ? "No table adds to 100%. Fix the numbers." : "No grading percentages found. Paste the grading section, or add components by hand."}</p>
      <div class="edtop"><label>Course name<input id="sylName" data-d="name" value="${esc(s.name)}"></label><label>Credits<input data-d="cr" type="number" min="0" step="any" value="${s.cr}"></label></div>
      <table class="dt"><thead><tr><th>Component</th><th>Weight %</th><th>Items</th><th></th></tr></thead><tbody>${s.comps.map((c, i) => `<tr><td><input data-d="cn" data-i="${i}" value="${esc(c.n)}" aria-label="Component name"></td><td><input class="n" data-d="cw" data-i="${i}" type="number" min="0" step="any" value="${c.w}" aria-label="Weight"></td><td><input class="n" data-d="ck" data-i="${i}" type="number" min="1" max="30" value="${c.items.length}" aria-label="Number of items"></td><td><button class="x" data-act="dRm" data-i="${i}" aria-label="Remove">×</button></td></tr>`).join("")}</tbody></table>
      <p class="foot" style="margin:0">total <b id="sylSum">${sumComps(s)}</b>% <button class="link" data-act="dAdd">Add component</button></p>
      ${s.scale ? `<label class="chk"><input type="checkbox" id="useScale" checked><span>Also use the grade scale in this file: ${s.scale.rows.map((r) => `${esc(r[1])} ${r[0]}+`).join(", ")}</span></label>` : ""}
      <div class="actions"><button class="btn primary" data-act="sylCreate"${s.comps.length ? "" : " disabled"}>Create course</button></div>`;
  }
  function importHTML() {
    const lang = lsGet(LANG_KEY) || "eng";
    return `<label class="drop" id="drop"><input type="file" id="file" accept=".pdf,.docx,.txt,.md,.text,.png,.jpg,.jpeg,.webp,.bmp,.gif"><b>Drop a syllabus here, or click</b><span class="muted">PDF, Word, text, or a photo or scan. Read on this device. Nothing is uploaded.</span></label>
      <label class="fld">Language of scans and photos<select class="ctl" id="ocrLang">${[["eng", "English"], ["rus+eng", "Russian + English"], ["kaz+rus+eng", "Kazakh + Russian + English"]].map(([v, l]) => `<option value="${v}"${v === lang ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="kl" for="syltxt">Or paste the grading section</label><textarea id="syltxt" placeholder="Assignments 20%&#10;Midterm 30%&#10;Final exam 50%"></textarea>
      <div class="actions"><button class="btn primary" data-act="sylDo">Find grading table</button><span class="foot" id="sylMsg" aria-live="polite"></span></div><div id="sylOut" style="display:grid;gap:12px">${sy ? sylHTML() : ""}</div>`;
  }
  function openImport() {
    openDlg("Import", importHTML());
  }
  const abs = (p) => new URL(p, location.href).href;
  const loadScript = (src) => new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => no(new Error("could not load " + src));
    document.head.appendChild(s);
  });
  function pdfText(items) {
    const rows = [];
    for (const it of items) {
      const y = Math.round(it.transform[5] / 3);
      let r = rows.find((q) => q.y === y);
      if (!r) { r = { y, parts: [] }; rows.push(r); }
      r.parts.push([it.transform[4], it.str, it.width]);
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map((r) => {
      r.parts.sort((a, b) => a[0] - b[0]);
      let s = "", end = null;
      for (const [x, str, w] of r.parts) { if (end !== null) s += x - end > 12 ? "\t" : x - end > 1 ? " " : ""; s += str; end = x + w; }
      return s.trim();
    }).filter(Boolean).join("\n");
  }
  let ocrW = null, ocrLang = "", ocrNote = () => {};
  async function ocr(src, lang) {
    if (!window.Tesseract) await loadScript(abs("vendor/tesseract/tesseract.min.js"));
    if (!ocrW || ocrLang !== lang) {
      if (ocrW) await ocrW.terminate();
      ocrW = await window.Tesseract.createWorker(lang, 1, {
        workerPath: abs("vendor/tesseract/worker.min.js"), corePath: abs("vendor/tesseract"), langPath: abs("vendor/tessdata"),
        logger: (m) => ocrNote(m.status === "recognizing text" ? `OCR ${Math.round(m.progress * 100)}%` : m.status),
      });
      ocrLang = lang;
    }
    return (await ocrW.recognize(src)).data.text;
  }
  async function readFile(file, lang, note) {
    const n = file.name.toLowerCase();
    ocrNote = note;
    if (/\.(png|jpe?g|webp|bmp|gif)$/.test(n)) return ocr(file, lang);
    if (n.endsWith(".pdf")) {
      if (!window.pdfjsLib) await loadScript(abs("vendor/pdfjs/pdf.min.js"));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = abs("vendor/pdfjs/pdf.worker.min.js");
      const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const out = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        let txt = pdfText((await page.getTextContent()).items);
        if (txt.replace(/\s/g, "").length < 25) {
          const pre = `page ${p}/${doc.numPages} · `;
          ocrNote = (s) => note(pre + s);
          note(pre + "scanned, reading pictures of text");
          const vp = page.getViewport({ scale: 2 }), cv = document.createElement("canvas");
          cv.width = vp.width;
          cv.height = vp.height;
          await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
          txt = await ocr(cv, lang);
        }
        out.push(txt);
      }
      return out.join("\n");
    }
    if (n.endsWith(".docx")) {
      if (!window.mammoth) await loadScript(abs("vendor/mammoth/mammoth.browser.min.js"));
      return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    }
    return file.text();
  }
  function detect(text, name) { sy = G.parseSyllabus(text, name); $("sylOut").innerHTML = sylHTML(); }
  async function takeFile(file) {
    const msg = $("sylMsg"), t0 = performance.now(), lang = $("ocrLang")?.value || "eng";
    msg.className = "foot";
    msg.innerHTML = `<i class="spin"></i>Reading ${esc(file.name)} <b class="num" id="el">0.0s</b> <span id="sylNote"></span>`;
    clearInterval(tickT);
    tickT = setInterval(() => { const el = $("el"); if (el) el.textContent = ((performance.now() - t0) / 1000).toFixed(1) + "s"; }, 100);
    try {
      const text = await readFile(file, lang, (s) => { const e = $("sylNote"); if (e) e.textContent = s; });
      $("syltxt").value = text;
      msg.textContent = text.trim() ? "" : "Nothing readable found. Try a sharper scan or paste the text.";
      detect(text, file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    } catch (err) {
      const file0 = location.protocol === "file:";
      msg.className = "foot fail";
      msg.textContent = "Could not read it (" + (err.message || err) + ")." + (file0 ? " Scans need the app served over http: run start.bat." : "") + " Paste the text instead.";
    }
    clearInterval(tickT);
  }

  function scaleHTML(d) {
    return `<label class="kl" for="presetSel">Preset</label><select class="ctl" id="presetSel"><option value="">Choose a preset</option>${Object.entries(G.PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join("")}</select>
      <label class="chk"><input type="checkbox" id="sclRound"${d.round ? " checked" : ""}><span>Round course total to whole number before grading (94.5 counts as 95)</span></label>
      <div class="scl"><div class="r h"><span>From %</span><span>Letter</span><span>Points</span><span></span></div>${d.rows.map((r, i) => `<div class="r"><input data-s="0" data-i="${i}" type="number" step="any" value="${r[0]}" aria-label="Minimum percent"><input class="l" data-s="1" data-i="${i}" value="${esc(r[1])}" aria-label="Letter"><input data-s="2" data-i="${i}" type="number" step="any" value="${r[2]}" aria-label="Points"><button class="x" data-act="sRm" data-i="${i}" aria-label="Remove row">×</button></div>`).join("")}</div>
      <div class="actions"><button class="btn" data-act="sAdd">Add row</button><button class="btn primary" data-act="sSave">Save scale</button></div>`;
  }
  let sd = null;
  const openScale = () => { sd = JSON.parse(JSON.stringify(S.scale)); openDlg("Grading scale", scaleHTML(sd)); };
  const backupText = () => JSON.stringify(S, null, 1);

  function flushSoon() { S.savedAt = Date.now(); clearTimeout(saveT); flush(); }
  const openBackup = () => openDlg("Backup", `<p class="foot" style="margin:0">Data lives in this browser only. Copy or download it. Paste it back to restore. Old artifact backups work too.</p>
    <pre class="code" id="bkView">${backupText().split("\n").map((l) => `<span>${esc(l)}</span>`).join("")}</pre>
    <div class="actions"><button class="btn" data-act="bkCopy">Copy</button><button class="btn" data-act="bkDownload">Download</button><span class="foot" id="bkMsg"></span></div>
    <label class="kl" for="bkIn">restore from backup text</label><textarea id="bkIn" spellcheck="false" placeholder="Paste backup here"></textarea>
    <div class="actions"><button class="btn primary" data-act="bkRestore">Restore</button><button class="link bad" data-act="wipe">Delete all data</button></div>`);

  $("dlgBody").addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const a = t.dataset.act, i = +t.dataset.i;
    if (a === "sylDo") { const txt = $("syltxt").value.trim(); if (txt) detect(txt, sy?.name && sy.name !== "New course" ? sy.name : ""); else $("sylMsg").textContent = "Choose a file or paste text first."; }
    else if (a === "dRm") { sy.comps.splice(i, 1); $("sylOut").innerHTML = sylHTML(); }
    else if (a === "dAdd") { sy.comps.push(G.mkComp("New component", 0, 1)); $("sylOut").innerHTML = sylHTML(); }
    else if (a === "sylCreate") {
      const c = newCourse(sy.name || "New course", sy.comps, sy.cr);
      if (sy.scale && $("useScale")?.checked) { S.scale = sy.scale; S.goals = {}; }
      sy = null;
      dlg.close();
      renderAll();
      save();
      status("added " + c.name);
    }
    else if (a === "sRm") { sd.rows.splice(i, 1); $("dlgBody").innerHTML = scaleHTML(sd); }
    else if (a === "sAdd") { sd.rows.splice(Math.max(0, sd.rows.length - 1), 0, [0, "?", 0]); $("dlgBody").innerHTML = scaleHTML(sd); }
    else if (a === "sSave") { S.scale = G.normScale(sd); S.goals = {}; for (const d of Object.values(S.tp)) d.goals = {}; for (const t2 of S.cg.terms) if (t2.g !== null) t2.g = Math.min(t2.g, top()); dlg.close(); renderAll(); save(); }
    else if (a === "bkCopy") { navigator.clipboard?.writeText(backupText()).then(() => { $("bkMsg").textContent = "copied"; }, () => { $("bkMsg").textContent = "copy failed here"; }); }
    else if (a === "bkDownload") {
      const url = URL.createObjectURL(new Blob([backupText()], { type: "application/json" }));
      const l = document.createElement("a");
      l.href = url;
      l.download = "gpa-planner-backup.json";
      l.click();
      URL.revokeObjectURL(url);
    }
    else if (a === "wipe") {
      if (!confirmReset) { confirmReset = true; t.textContent = "Click again: deletes all courses, grades, terms"; return; }
      S = norm({});
      editing.clear();
      sel = null;
      confirmReset = false;
      dlg.close();
      renderAll();
      save();
      status("all data deleted");
    }
    else if (a === "bkRestore") {
      try {
        const j = JSON.parse($("bkIn").value);
        if (!j || !Array.isArray(j.courses)) throw new Error("bad");
        S = norm(j.courses[0] && j.courses[0].mid ? G.migrateV1(j) : j);
        editing.clear();
        sel = null;
        dlg.close();
        renderAll();
        flush();
        status("restored");
      } catch (err) { $("bkMsg").textContent = "not a valid backup"; $("bkMsg").className = "foot fail"; }
    }
  });
  $("dlgBody").addEventListener("input", (e) => {
    const t = e.target, d = t.dataset.d, i = +t.dataset.i;
    if (d && sy) {
      if (d === "name") sy.name = t.value;
      else if (d === "cr") sy.cr = Math.max(0, +t.value || 0);
      else if (d === "cn") sy.comps[i].n = t.value;
      else if (d === "cw") sy.comps[i].w = Math.max(0, +t.value || 0);
      $("sylSum").textContent = sumComps(sy);
    }
    if (t.dataset.s !== undefined && sd) sd.rows[i][+t.dataset.s] = t.dataset.s === "1" ? t.value : +t.value;
    if (t.id === "sclRound" && sd) sd.round = t.checked;
  });
  $("dlgBody").addEventListener("change", (e) => {
    const t = e.target, i = +t.dataset.i;
    if (t.dataset.d === "ck" && sy) {
      const k = Math.min(30, Math.max(1, Math.round(+t.value) || 1)), c = sy.comps[i];
      sy.comps[i] = { ...G.mkComp(c.n, c.w, k) };
      t.value = k;
    }
    if (t.id === "presetSel" && t.value && sd) { sd = JSON.parse(JSON.stringify(G.PRESETS[t.value])); $("dlgBody").innerHTML = scaleHTML(sd); }
    if (t.id === "sclRound" && sd) sd.round = t.checked;
    if (t.id === "file" && t.files[0]) takeFile(t.files[0]);
    if (t.id === "ocrLang") lsSet(LANG_KEY, t.value);
  });
  $("dlgBody").addEventListener("dragover", (e) => { if (e.target.closest("#drop")) { e.preventDefault(); $("drop").classList.add("over"); } });
  $("dlgBody").addEventListener("dragleave", () => $("drop")?.classList.remove("over"));
  $("dlgBody").addEventListener("drop", (e) => { if (e.target.closest("#drop")) { e.preventDefault(); $("drop").classList.remove("over"); if (e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]); } });

  const pal = $("pal");
  let palSel = 0, palItems = [];
  function palActions() {
    return [
      ...S.courses.map((c) => ({ l: c.name, h: "course", run: () => select(c.id) })),
      { l: "Add course", h: "action", run: addByHand },
      { l: "Grading scale", h: "action", run: openScale },
      { l: "Backup and restore", h: "action", run: openBackup },
      { l: "Load example courses", h: "action", run: loadExample },
      { l: "Theme: next", h: "action", run: () => { const o = ["auto", "light", "dark"]; lsSet(THEME_KEY, o[(o.indexOf(getTheme()) + 1) % 3]); applyTheme(); glideTheme(); } },
    ];
  }
  function palRender() {
    const q = $("palQ").value.trim().toLowerCase();
    palItems = palActions().filter((x) => !q || x.l.toLowerCase().includes(q));
    palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    $("palL").innerHTML = palItems.map((x, i) => `<li role="option" data-i="${i}" class="${i === palSel ? "sel" : ""}"><span>${esc(x.l)}</span><small>${x.h}</small></li>`).join("") || '<li><span class="muted">Nothing found</span></li>';
  }
  function openPal() { $("palQ").value = ""; palSel = 0; palRender(); if (!pal.open) pal.showModal(); $("palQ").focus(); }
  function palRun(i) { const x = palItems[i]; if (!x) return; pal.close(); x.run(); }
  $("palQ").addEventListener("input", () => { palSel = 0; palRender(); });
  $("palQ").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); palRender(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(0, palSel - 1); palRender(); }
    else if (e.key === "Enter") { e.preventDefault(); palRun(palSel); }
  });
  $("palL").addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) palRun(+li.dataset.i); });
  pal.addEventListener("click", (e) => { if (e.target === pal) pal.close(); });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.open ? pal.close() : openPal(); }
  });

  function renderWidget() {
    const el = $("wg") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "wg" }));
    if (!S.courses.length) { el.innerHTML = '<div class="wg"><p class="wg-empty">No courses yet.</p><div class="wg-foot"><a href="./" target="_blank">Open app</a></div></div>'; return; }
    const x = G.summarize(S.courses, S.scores, S.scale, S.goals, S.cg.boost), cg = S.cg, tp = top(), T = +cg.target;
    const fin = cg.terms.filter((t) => t.g !== null).map((t) => t.g), k = fin.length, cgpa = k ? fin.reduce((q, w) => q + w, 0) / k : null;
    const p = G.cgPlan(cg.terms, T, x.goal ?? 0, tp);
    const plan = p.ci >= 0 && p.L > 0 ? (p.a <= 0 ? "secured" : p.a > tp + 1e-9 ? "out of reach" : "avg " + f2(p.a) + " for " + p.L + " more terms") : "";
    const cgLine = [cgpa === null ? "No terms yet" : "CGPA " + f2(cgpa), "target " + f2(T), plan].filter(Boolean).join(" · ");
    const col = lsGet("gpa-wg-collapsed") === "1";
    if (col) {
      el.innerHTML = `<div class="wg wg-min"><b class="num">${x.goal === null ? "–" : f2(x.goal)}</b><span>Now ${x.now === null ? "–" : f2(x.now)}${cgpa === null ? "" : " · CGPA " + f2(cgpa)}</span><button class="link" data-wg="col">Expand</button></div>`;
      if (window.gpaDesktop) gpaDesktop.resize(el.firstElementChild.offsetHeight);
      return;
    }
    const rows = S.courses.map((c) => {
      const r = G.calcCourse(c, S.scores, S.scale, S.goals), live = c.comps.some((i) => i.items.length), n = needOf(r), st = mkStatus(r, live, n);
      let left = 0;
      c.comps.forEach((comp, ci) => comp.items.forEach((_, ii) => { if (G.score(S.scores, c.id, ci, ii) === null) left++; }));
      const cur = r.final ?? r.pace, now = cur === null ? "no grades yet" : show(cur) + "% " + bandOf(cur)[1];
      const goal = r.goal === null ? "" : " · goal " + bandOf(r.goal)[1];
      const right = r.final !== null ? "done" : r.goal === null ? "out of reach" : n <= 0 ? "secured" : "need " + n;
      return `<li><i class="dotc ${st ? st[1] : ""}"></i><div class="wg-c"><span class="nm">${esc(c.name)}</span><small>${now}${goal} · ${left} left</small><span class="wg-bar"><i style="width:${Math.min(100, r.earned + r.rest)}%" class="p"></i><i style="width:${Math.min(100, r.earned)}%"></i></span></div><b class="num${n >= 90 && r.final === null ? " hard" : ""}">${right}</b></li>`;
    }).join("");
    el.innerHTML = `<div class="wg"><div class="wg-top"><div><span class="kl">GPA if you hit your goals</span><b class="wg-big num">${x.goal === null ? "–" : f2(x.goal)}</b></div><div class="wg-r"><span class="kl">Now</span><b class="wg-now num">${x.now === null ? "–" : f2(x.now)}</b><span class="kl">Best ${x.max === null ? "–" : f2(x.max)}</span></div></div><p class="wg-cg">${esc(cgLine)}</p><ul>${rows}</ul><div class="wg-foot"><button class="link" data-wg="pip">Keep on top</button><button class="link" data-wg="col">Collapse</button><a href="./" target="_blank">Open app</a></div></div>`;
    if (window.gpaDesktop) gpaDesktop.resize(el.firstElementChild.offsetHeight);
  }
  async function floatWidget() {
    if (!window.documentPictureInPicture) { document.querySelector("[data-wg]").textContent = "Needs a newer Chrome"; return; }
    const pip = await documentPictureInPicture.requestWindow({ width: 340, height: 320 });
    for (const ss of document.styleSheets) if (ss.href) { const l = pip.document.createElement("link"); l.rel = "stylesheet"; l.href = ss.href; pip.document.head.appendChild(l); }
    pip.document.body.append($("wg"));
    pip.addEventListener("pagehide", () => document.body.append($("wg")));
  }
  if (location.hash === "#widget") {
    document.body.classList.add("widget");
    applyTheme();
    renderWidget();
    document.addEventListener("click", (e) => { const c = e.target.closest("[data-wg=col]"); if (c) { lsSet("gpa-wg-collapsed", lsGet("gpa-wg-collapsed") === "1" ? "0" : "1"); renderWidget(); return; } const b = e.target.closest("[data-wg=pip]"); if (!b) return; if (window.gpaDesktop) gpaDesktop.toggleTop().then((on) => { b.textContent = on ? "On top" : "Keep on top"; }); else floatWidget(); });
    addEventListener("storage", (e) => { if (e.key === STORE || e.key === THEME_KEY) { S = load(); applyTheme(); renderWidget(); } });
    return;
  }
  applyTheme();
  initStrip();
  renderAll();
  status(S.savedAt ? "Loaded · stays on this device" : "Nothing saved yet · stays on this device");
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
