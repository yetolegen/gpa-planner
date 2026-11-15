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
  const BOOKMARKLET = "javascript:(function(){var t=document.querySelector('table.user-grade,table.generaltable.user-grade,.user-report-container table');if(!t){alert('Open Moodle > Grades > User report first, then click this bookmark again.');return}var o=[];t.querySelectorAll('tbody tr').forEach(function(tr){var h=tr.querySelector('th.column-itemname,td.column-itemname,th.gradeitemheader');if(!h)return;var q=function(s){var e=tr.querySelector(s);return e?e.textContent.replace(/\\s+/g,' ').trim():''};var c=tr.className+' '+h.className;var m=c.match(/level(\\d+)/);var n=(h.querySelector('.rowtitle')||h).textContent.replace(/\\s+/g,' ').trim();o.push({name:n,depth:m?+m[1]:0,kind:/categoryitem/.test(c)?'categoryitem':/courseitem/.test(c)?'total':/category/.test(c)?'category':'item',weight:q('.column-weight'),grade:q('.column-grade'),range:q('.column-range'),pct:q('.column-percentage')})});var j=JSON.stringify({moodle:1,rows:o});(navigator.clipboard?navigator.clipboard.writeText(j):Promise.reject()).then(function(){alert('Copied '+o.length+' grade rows. Paste them into GPA Planner.')},function(){prompt('Copy this text:',j)})})()";
  const svg = (d) => `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    plus: svg('<path d="M8 3v10M3 8h10"/>'),
    up: svg('<path d="M8 10V2m0 0L5 5m3-3l3 3M3 13h10"/>'),
    down: svg('<path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10"/>'),
    sliders: svg('<path d="M2 5h7m3 0h2M2 11h2m3 0h7"/><circle cx="10.5" cy="5" r="1.5"/><circle cx="5.5" cy="11" r="1.5"/>'),
    search: svg('<circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/>'),
    sync: svg('<path d="M13 8a5 5 0 0 0-9-3M3 2v3h3M3 8a5 5 0 0 0 9 3M13 14v-3h-3"/>'),
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
  const fresh = () => ({ scale: G.PRESETS.us, courses: [], scores: {}, goals: {}, cg: { terms: [], target: 3.5, boost: 5, perYear: 2, years: 4 }, sync: null, savedAt: 0 });
  function norm(s) {
    const b = fresh();
    const o = { ...b, ...s, cg: { ...b.cg, ...(s.cg || {}) } };
    o.scale = G.normScale(o.scale || b.scale);
    o.courses = (o.courses || []).map((c) => ({
      id: c.id || uid(), name: c.name || "Course", cr: c.cr ?? 3, mc: c.mc, sig: c.sig,
      comps: (c.comps || []).map((x) => ({ n: x.n, w: +x.w || 0, min: x.min, items: (x.items || []).map((i) => ({ n: i.n, w: +i.w || 0 })) })),
    }));
    o.scores = o.scores || {};
    o.goals = o.goals || {};
    const y = o.sync;
    o.sync = y && typeof y === "object" ? { site: y.site || "", token: y.token || "", userid: y.userid, name: y.name || "", minutes: [0, 15, 30, 60].includes(+y.minutes) ? +y.minutes : 30, track: y.track || {}, courses: y.courses || [], last: +y.last || 0, msg: y.msg || "" } : null;
    o.cg.perYear = Math.max(1, +o.cg.perYear || 2);
    o.cg.years = Math.max(1, +o.cg.years || 4);
    o.cg.terms = (o.cg.terms || []).map((t) => ({ g: t.g === null || t.g === undefined || t.g === "" ? null : +t.g, r: !!t.r }));
    fixTerms(o.cg);
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
        <button class="tl" data-go="sync">${ICON.sync}<span class="nm">Moodle sync</span><span class="nb" id="syncSt"></span></button>
        <button class="tl" data-go="scale">${ICON.sliders}Grading scale</button>
        <button class="tl" data-go="backup">${ICON.down}Backup</button></div></div>
      <div class="sidefoot"><div class="thm seg" id="thm">${["auto", "light", "dark"].map((t) => `<button data-theme="${t}" class="${getTheme() === t ? "on" : ""}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div><span class="saved" id="saved"></span></div>`;
    syncLabel();
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
    refreshCg(S.courses.length ? x.goal : null);
  }
  function renderLegend() {
    $("legend").innerHTML = `<span>Scale: <b>${esc(S.scale.name)}</b>${S.scale.round ? ", totals round to whole first" : ""}</span><button class="link" data-go="scale">Change</button>`;
  }

  function itemPct(c, r, ci, ii) {
    const items = c.comps[ci].items, t = items.reduce((a, x) => a + (+x.w || 0), 0);
    return ((t > 0 ? (+items[ii].w || 0) / t : 1 / items.length) * r.w[ci]) * 100;
  }
  const emptyHTML = () => `<div class="empty"><h3>No courses yet</h3><p class="muted" style="margin:0;max-width:56ch">Type grades as they land. See the score you need on everything left.</p>
    <button class="opt" data-go="import">${ICON.up}<div><b>Import syllabus or Moodle grades</b><span>PDF, Word, text, or paste a Moodle table</span></div></button>
    <button class="opt" data-go="add">${ICON.plus}<div><b>Add a course by hand</b><span>Pick components and weights yourself</span></div></button>
    <button class="opt" data-go="example">${ICON.plus}<div><b>Try example courses</b><span>See how it works</span></div></button></div>`;
  function editorHTML(c) {
    return `<div class="ed"><div class="edtop">
      <label for="ed-name">Course name<input id="ed-name" data-ed="name" value="${esc(c.name)}"></label>
      <label for="ed-cr">Credits<input id="ed-cr" data-ed="cr" type="number" min="0" step="any" inputmode="decimal" value="${c.cr ?? 3}"></label></div>
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
  function renderCourse() {
    if (!S.courses.length) { $("cv").innerHTML = emptyHTML(); return; }
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
    q(".cvMeta").innerHTML = [`${c.cr ?? 3} credits`, st ? `<span class="tg ${st[1]}">${st[0]}</span>` : "", r.final !== null ? `Final <b>${show(r.final)}%</b> ${esc(bandOf(r.final)[1])}` : r.pace !== null ? `Now <b>${show(r.pace)}%</b> ${esc(bandOf(r.pace)[1])}` : "", c.mc ? "Synced from Moodle" : ""].filter(Boolean).join(" · ");
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
    else if (go === "sync") openSync();
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
    else if (t.dataset.term !== undefined) S.cg.terms[+t.dataset.term].g = t.value === "" ? null : Math.min(top(), Math.max(0, +t.value));
    else return;
    renderStrip();
    save();
  });
  function setTarget(v) { S.cg.target = Math.min(top(), Math.max(0, Math.round(v * 100) / 100)); cgSkeleton(); renderStrip(); save(); }
  $("cg").addEventListener("click", (e) => {
    const t = e.target;
    const rm = t.closest("[data-rm]");
    if (rm) { S.cg.terms.splice(+rm.dataset.rm, 1); cgSkeleton(); renderStrip(); save(); return; }
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

  let sy = null, mo = null, tab = "syllabus", tickT = 0;
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
  function moHTML() {
    const m = mo;
    const opts = S.courses.map((c) => `<option value="${c.id}"${c.id === (cur() && cur().id) ? " selected" : ""}>${esc(c.name)}</option>`).join("");
    return `<p class="${m.count ? "ok" : "fail"}" style="margin:0">${m.count ? `Read ${m.count} rows, ${Object.keys(m.scores).length} with a grade.` : "No grade rows found. Check what you pasted."}</p>
      <table class="dt"><thead><tr><th>Component</th><th>Weight %</th><th>Items</th></tr></thead><tbody>${m.comps.map((c) => `<tr><td>${esc(c.n)}</td><td class="num">${c.w}</td><td class="num">${c.items.length}</td></tr>`).join("")}</tbody></table>
      <label class="chk"><input type="radio" name="moMode" value="new"${S.courses.length ? "" : " checked"}><span>New course named <input id="moName" value="${esc(m.name)}"></span></label>
      ${S.courses.length ? `<label class="chk"><input type="radio" name="moMode" value="fill" checked><span>Fill grades into course (match by item name): <select class="ctl" id="moCourse">${opts}</select></span></label>` : ""}
      <div class="actions"><button class="btn primary" data-act="moApply"${m.count ? "" : " disabled"}>Apply</button><span class="foot" id="moRes"></span></div>`;
  }
  function importHTML() {
    const t = (id, label) => `<button class="tab${tab === id ? " on" : ""}" role="tab" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`;
    const head = `<div class="tabs seg" role="tablist">${t("syllabus", "Syllabus")}${t("moodle", "Moodle grades")}</div>`;
    const lang = lsGet(LANG_KEY) || "eng";
    if (tab === "syllabus") return head + `<label class="drop" id="drop"><input type="file" id="file" accept=".pdf,.docx,.txt,.md,.text,.png,.jpg,.jpeg,.webp,.bmp,.gif"><b>Drop a syllabus here, or click</b><span class="muted">PDF, Word, text, or a photo or scan. Read on this device. Nothing is uploaded.</span></label>
      <label class="fld">Language of scans and photos<select class="ctl" id="ocrLang">${[["eng", "English"], ["rus+eng", "Russian + English"], ["kaz+rus+eng", "Kazakh + Russian + English"]].map(([v, l]) => `<option value="${v}"${v === lang ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="kl" for="syltxt">Or paste the grading section</label><textarea id="syltxt" placeholder="Assignments 20%&#10;Midterm 30%&#10;Final exam 50%"></textarea>
      <div class="actions"><button class="btn primary" data-act="sylDo">Find grading table</button><span class="foot" id="sylMsg" aria-live="polite"></span></div><div id="sylOut" style="display:grid;gap:12px">${sy ? sylHTML() : ""}</div>`;
    return head + `<ol class="steps"><li>In Moodle open <b>Grades</b> for your course, then <b>User report</b>.</li><li>Click the <b>Grab Moodle grades</b> bookmark (drag the button to your bookmarks bar once), or select the grades table and copy it.</li><li>Paste below.</li></ol>
      <div class="actions"><a class="btn" id="bm" href="#" draggable="true">Grab Moodle grades</a><button class="link" data-act="bmCopy">Copy bookmark code instead</button></div>
      <p class="foot" style="margin:0">Runs inside your own logged-in Moodle page. Your password goes nowhere. Themes differ: if the bookmark finds nothing, copy and paste the table. Want it automatic? Use Moodle sync.</p>
      <textarea id="motxt" placeholder="Paste Moodle grades here"></textarea>
      <div class="actions"><button class="btn primary" data-act="moDo">Read grades</button></div><div id="moOut" style="display:grid;gap:12px">${mo ? moHTML() : ""}</div>`;
  }
  function openImport() {
    tab = "syllabus";
    openDlg("Import", importHTML());
    if ($("bm")) $("bm").setAttribute("href", BOOKMARKLET);
    glide($("dlgBody").querySelector(".tabs"), "tabs");
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
  const backupText = () => JSON.stringify({ ...S, sync: S.sync ? { ...S.sync, token: "" } : null }, null, 1);

  const siteOf = (s) => {
    try {
      const u = new URL(/^https?:\/\//i.test(s.trim()) ? s.trim() : "https://" + s.trim());
      return u.origin + u.pathname.replace(/\/(?:my|course|grade|user|mod|login|webservice|report|calendar|admin|index\.php)\b.*$/i, "").replace(/\/+$/, "");
    } catch (e) { return ""; }
  };
  async function ws(fn, p = {}) {
    const y = S.sync;
    let r;
    try { r = await fetch(y.site + "/webservice/rest/server.php", { method: "POST", body: new URLSearchParams({ wstoken: y.token, wsfunction: fn, moodlewsrestformat: "json", ...p }) }); }
    catch (e) { throw new Error(window.chrome?.runtime?.id ? "could not reach Moodle" : "the browser blocked the request. Moodle does not let web pages read it. Use the extension build (see README)"); }
    let j;
    try { j = await r.json(); } catch (e) { throw new Error("Moodle did not answer like a web service. Check the address"); }
    if (j && j.exception) throw new Error(j.message || j.errorcode || "Moodle refused");
    return j;
  }
  async function page(p) {
    let r;
    try { r = await fetch(S.sync.site + p, { credentials: "include" }); } catch (e) { throw new Error(window.chrome?.runtime?.id ? "could not reach Moodle" : "the browser blocked the request. Use the extension build (see README)"); }
    if (/\/login\//.test(r.url) || r.status === 403) throw new Error("you are logged out of Moodle. Open Moodle, log in, then try again");
    if (!r.ok) throw new Error("Moodle answered " + r.status);
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    if (doc.querySelector("form#login, form[action*='login/index.php']")) throw new Error("you are logged out of Moodle. Open Moodle, log in, then try again");
    return doc;
  }
  function tableRows(doc) {
    const t = doc.querySelector("table.user-grade,table.generaltable.user-grade,.user-report-container table");
    if (!t) return null;
    const o = [], clean = (e) => e.textContent.replace(/\s+/g, " ").trim();
    t.querySelectorAll("tbody tr").forEach((tr) => {
      const h = tr.querySelector("th.column-itemname,td.column-itemname,th.gradeitemheader");
      if (!h) return;
      const q = (s) => { const e = tr.querySelector(s); return e ? clean(e) : ""; };
      const c = tr.className + " " + h.className, m = c.match(/level(\d+)/);
      o.push({ name: clean(h.querySelector(".rowtitle") || h), depth: m ? +m[1] : 0, kind: /categoryitem/.test(c) ? "categoryitem" : /courseitem/.test(c) ? "total" : /category/.test(c) ? "category" : "item", weight: q(".column-weight"), grade: q(".column-grade"), range: q(".column-range"), pct: q(".column-percentage") });
    });
    return o;
  }
  const ensureAccess = async (site) => (window.chrome?.permissions?.request ? chrome.permissions.request({ origins: [new URL(site).origin + "/*"] }) : true);
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
  function syncLabel() {
    const e = $("syncSt"), y = S.sync;
    if (e) e.textContent = !y || !y.site ? "" : syncing ? "syncing" : y.last ? ago(y.last) : "on";
  }
  const sigOf = (comps) => JSON.stringify(comps.map((c) => [c.n, c.items.map((i) => i.n)]));
  let syncing = false;
  async function syncNow() {
    const y = S.sync;
    if (!y || !y.site || syncing) return;
    syncing = true;
    syncLabel();
    const keep = sel, errs = [];
    let items = 0, made = 0;
    for (const mc of (y.courses || []).filter((c) => y.track[c.id])) {
      try {
        const rows = y.token ? G.wsRows(await ws("gradereport_user_get_grade_items", { courseid: mc.id, userid: y.userid })) : tableRows(await page("/grade/report/user/index.php?id=" + mc.id + (y.userid ? "&userid=" + y.userid : "")));
        if (!rows) throw new Error("no grade table on the page");
        const d = G.parseMoodle(JSON.stringify({ moodle: 1, rows }));
        if (!d.count) continue;
        const sig = sigOf(d.comps);
        let c = S.courses.find((x) => x.mc === mc.id);
        if (!c) { c = newCourse(mc.name, d.comps, d.cr); c.mc = mc.id; made++; }
        if (c.sig !== sig) {
          if (c.sig) for (const k of Object.keys(S.scores)) if (k.startsWith(c.id + "|")) delete S.scores[k];
          c.comps = d.comps;
          c.sig = sig;
        }
        for (const [k, v] of Object.entries(d.scores)) { S.scores[`${c.id}|${k}`] = v; items++; }
      } catch (e) { errs.push(`${mc.name}: ${e.message}`); }
    }
    sel = keep && S.courses.find((c) => c.id === keep) ? keep : S.courses[0] && S.courses[0].id;
    y.last = Date.now();
    y.msg = errs.length ? errs.join("; ") : `${items} grades from ${(y.courses || []).filter((c) => y.track[c.id]).length} courses${made ? `, ${made} new` : ""}`;
    syncing = false;
    flushSoon();
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !dlg.open;
    const redraw = () => { renderAll(); syncLabel(); };
    typing ? setTimeout(redraw, 4000) : redraw();
    const m = $("syMsg");
    if (m) { m.textContent = (errs.length ? "Problem: " : "Done: ") + y.msg; m.className = errs.length ? "foot fail" : "foot ok"; }
    return errs.length === 0;
  }
  function flushSoon() { S.savedAt = Date.now(); clearTimeout(saveT); flush(); }
  function syncHTML() {
    const y = S.sync;
    if (!y || !y.site) return `<ol class="steps"><li>Open your Moodle in this browser and log in, like you do every day.</li><li>Paste the Moodle address below (the page you see after login is fine).</li><li>Click <b>Connect</b>. The extension reads your grades with your own login. No key, no password.</li></ol>
      <label class="fld">Moodle address<input id="syncSite" placeholder="https://lms.your-school.edu" value="${esc(y ? y.site : "")}" autocomplete="off"></label>
      <details><summary class="link">I have a Moodle security key</summary><label class="fld" style="margin-top:8px">Security key, optional<input id="syncTok" type="password" autocomplete="off" spellcheck="false"></label></details>
      <p class="foot" style="margin:0">Needs the extension build (see README). Grades are only read. Nothing leaves your browser except requests to your own Moodle. Sessions expire: if sync says you are logged out, open Moodle once and log in again.</p>
      <div class="actions"><button class="btn primary" data-act="syConnect">Connect</button><span class="foot" id="syMsg" aria-live="polite"></span></div>`;
    return `<p class="meta" style="margin:0">Connected to <b>${esc(y.site)}</b>${y.name ? ` as <b>${esc(y.name)}</b>` : ""}. ${y.last ? "Last sync " + ago(y.last) + "." : "Not synced yet."}</p>
      <div class="clist">${(y.courses || []).map((c) => `<label class="chk"><input type="checkbox" data-mc="${c.id}"${y.track[c.id] ? " checked" : ""}><span>${esc(c.name)}</span></label>`).join("") || '<p class="muted" style="margin:0">No courses found.</p>'}</div>
      <label class="fld">Sync every<select class="ctl" id="syMin">${[[0, "Never, only when I press the button"], [15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"]].map(([v, l]) => `<option value="${v}"${y.minutes === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <p class="foot" style="margin:0">Checked courses are built from Moodle on the first sync, then grades update. Syncing runs while this page is open. Grades you type on items Moodle has not graded stay.</p>
      <div class="actions"><button class="btn primary" data-act="syNow">Sync now</button><button class="link bad" data-act="syOff">Disconnect and forget the key</button><span class="foot" id="syMsg" aria-live="polite">${esc(y.msg || "")}</span></div>`;
  }
  const openSync = () => openDlg("Moodle sync", syncHTML());
  async function syConnect() {
    const m = $("syMsg"), site = siteOf($("syncSite").value), token = $("syncTok").value.trim();
    const say = (t, bad) => { m.textContent = t; m.className = "foot" + (bad ? " fail" : ""); };
    if (!site) { say("Type your Moodle address.", true); return; }
    say("Connecting…");
    const prev = S.sync;
    try {
      if (!(await ensureAccess(site))) throw new Error("permission to reach that site was declined");
      S.sync = { site, token, userid: 0, name: "", minutes: 30, track: {}, courses: [], last: 0, msg: "" };
      if (token) {
        const info = await ws("core_webservice_get_site_info");
        const list = await ws("core_enrol_get_users_courses", { userid: info.userid });
        S.sync.userid = info.userid;
        S.sync.name = info.fullname || "";
        S.sync.courses = (Array.isArray(list) ? list : []).map((c) => ({ id: c.id, name: c.fullname || c.shortname || "Course " + c.id }));
      } else {
        const doc = await page("/grade/report/overview/index.php");
        const seen = new Map();
        doc.querySelectorAll("a[href]").forEach((a) => {
          const u = new URL(a.getAttribute("href"), S.sync.site + "/"), id = +u.searchParams.get("id");
          if (id > 1 && /\/(grade\/report\/(user|overview)|course)\//.test(u.pathname) && a.textContent.trim() && !seen.has(id)) seen.set(id, a.textContent.replace(/\s+/g, " ").trim());
          if (+u.searchParams.get("userid") && !S.sync.userid) S.sync.userid = +u.searchParams.get("userid");
        });
        S.sync.courses = [...seen].map(([id, name]) => ({ id, name }));
        if (!S.sync.courses.length) throw new Error("no courses found on the grades overview page");
      }
      for (const c of S.sync.courses) S.sync.track[c.id] = true;
      flushSoon();
      $("dlgBody").innerHTML = syncHTML();
      syncLabel();
    } catch (e) { S.sync = prev; say("Could not connect: " + e.message, true); }
  }
  setInterval(() => {
    const y = S.sync;
    if (y && y.site && y.minutes && Date.now() - y.last >= y.minutes * 60000) syncNow();
    syncLabel();
  }, 30000);
  const openBackup = () => openDlg("Backup", `<p class="foot" style="margin:0">Data lives in this browser only. Copy or download it. Paste it back to restore. Old artifact backups work too.</p>
    <pre class="code" id="bkView">${backupText().split("\n").map((l) => `<span>${esc(l)}</span>`).join("")}</pre>
    <div class="actions"><button class="btn" data-act="bkCopy">Copy</button><button class="btn" data-act="bkDownload">Download</button><span class="foot" id="bkMsg"></span></div>
    <label class="kl" for="bkIn">restore from backup text</label><textarea id="bkIn" spellcheck="false" placeholder="Paste backup here"></textarea>
    <div class="actions"><button class="btn primary" data-act="bkRestore">Restore</button><button class="link bad" data-act="wipe">Delete all data</button></div>`);

  $("dlgBody").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab],[data-act]");
    if (!t) return;
    if (t.dataset.tab) {
      tab = t.dataset.tab;
      $("dlgBody").innerHTML = importHTML();
      if ($("bm")) $("bm").setAttribute("href", BOOKMARKLET);
      glide($("dlgBody").querySelector(".tabs"), "tabs");
      return;
    }
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
    else if (a === "syConnect") syConnect();
    else if (a === "syNow") { t.disabled = true; $("syMsg").textContent = "Syncing…"; syncNow().finally(() => { t.disabled = false; }); }
    else if (a === "syOff") { S.sync = null; flushSoon(); $("dlgBody").innerHTML = syncHTML(); syncLabel(); }
    else if (a === "bmCopy") { navigator.clipboard?.writeText(BOOKMARKLET).then(() => { t.textContent = "copied. new bookmark, paste as address."; }, () => { t.textContent = "copy failed here"; }); }
    else if (a === "moDo") { const txt = $("motxt").value.trim(); if (txt) { mo = G.parseMoodle(txt); $("moOut").innerHTML = moHTML(); } }
    else if (a === "moApply") {
      const mode = dlg.querySelector("input[name=moMode]:checked")?.value || "new";
      if (mode === "fill") {
        const c = S.courses.find((x) => x.id === $("moCourse").value);
        const r = G.fillScores(c, S.scores, mo);
        sel = c.id;
        $("moRes").textContent = `Filled ${r.filled} grades.` + (r.unmatched.length ? ` No match: ${r.unmatched.join(", ")}.` : "");
        $("moRes").className = r.unmatched.length ? "foot fail" : "foot ok";
        renderAll();
        save();
      } else {
        const c = newCourse($("moName").value.trim() || mo.name, mo.comps, mo.cr);
        for (const [k, v] of Object.entries(mo.scores)) S.scores[`${c.id}|${k}`] = v;
        mo = null;
        dlg.close();
        renderAll();
        save();
        status("added " + c.name + " with grades");
      }
    }
    else if (a === "sRm") { sd.rows.splice(i, 1); $("dlgBody").innerHTML = scaleHTML(sd); }
    else if (a === "sAdd") { sd.rows.splice(Math.max(0, sd.rows.length - 1), 0, [0, "?", 0]); $("dlgBody").innerHTML = scaleHTML(sd); }
    else if (a === "sSave") { S.scale = G.normScale(sd); S.goals = {}; for (const t2 of S.cg.terms) if (t2.g !== null) t2.g = Math.min(t2.g, top()); dlg.close(); renderAll(); save(); }
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
    if (t.dataset.mc && S.sync) { S.sync.track[t.dataset.mc] = t.checked; save(); }
    if (t.id === "syMin" && S.sync) { S.sync.minutes = +t.value; save(); }
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
      { l: "Import syllabus or Moodle grades", h: "action", run: openImport },
      { l: "Moodle sync", h: "action", run: openSync },
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
  setTimeout(() => { const y = S.sync; if (y && y.site && y.minutes && Date.now() - y.last >= y.minutes * 60000) syncNow(); }, 1500);
})();
