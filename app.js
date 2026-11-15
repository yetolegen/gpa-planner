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
  const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
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
      ind.style.transition = "transform .38s cubic-bezier(.3,1.25,.5,1), width .38s cubic-bezier(.3,1.25,.5,1)";
      put(now);
    } else put(now);
    gpos.set(key, now);
  }
  const STORE = "gpa-planner-v2";
  const BOOKMARKLET = "javascript:(function(){var t=document.querySelector('table.user-grade,table.generaltable.user-grade,.user-report-container table');if(!t){alert('Open Moodle > Grades > User report first, then click this bookmark again.');return}var o=[];t.querySelectorAll('tbody tr').forEach(function(tr){var h=tr.querySelector('th.column-itemname,td.column-itemname,th.gradeitemheader');if(!h)return;var q=function(s){var e=tr.querySelector(s);return e?e.textContent.replace(/\\s+/g,' ').trim():''};var c=tr.className+' '+h.className;var m=c.match(/level(\\d+)/);var n=(h.querySelector('.rowtitle')||h).textContent.replace(/\\s+/g,' ').trim();o.push({name:n,depth:m?+m[1]:0,kind:/categoryitem/.test(c)?'categoryitem':/courseitem/.test(c)?'total':/category/.test(c)?'category':'item',weight:q('.column-weight'),grade:q('.column-grade'),range:q('.column-range'),pct:q('.column-percentage')})});var j=JSON.stringify({moodle:1,rows:o});(navigator.clipboard?navigator.clipboard.writeText(j):Promise.reject()).then(function(){alert('Copied '+o.length+' grade rows. Paste them into GPA Planner.')},function(){prompt('Copy this text:',j)})})()";

  const stdCount = (cg) => cg.terms.filter((t) => !t.r).length;
  function fixTerms(cg) {
    const n = Math.max(1, cg.perYear) * Math.max(1, cg.years);
    for (let s = stdCount(cg); s < n; s++) cg.terms.splice(s, 0, { g: null, r: false });
    for (let i = cg.terms.length - 1; i >= 0 && stdCount(cg) > n; i--) if (!cg.terms[i].r && cg.terms[i].g === null) cg.terms.splice(i, 1);
  }
  const fresh = () => ({ scale: G.PRESETS.us, courses: [], scores: {}, goals: {}, cg: { terms: [], target: 3.5, boost: 5, perYear: 2, years: 4 }, savedAt: 0 });
  function norm(s) {
    const b = fresh();
    const o = { ...b, ...s, cg: { ...b.cg, ...(s.cg || {}) } };
    o.scale = G.normScale(o.scale || b.scale);
    o.courses = (o.courses || []).map((c) => ({
      id: c.id || uid(), name: c.name || "Course", cr: c.cr ?? 3,
      comps: (c.comps || []).map((x) => ({ n: x.n, w: +x.w || 0, min: x.min, items: (x.items || []).map((i) => ({ n: i.n, w: +i.w || 0 })) })),
    }));
    o.scores = o.scores || {};
    o.goals = o.goals || {};
    o.cg.perYear = Math.max(1, +o.cg.perYear || 2);
    o.cg.years = Math.max(1, +o.cg.years || 4);
    o.cg.terms = (o.cg.terms || []).map((t) => ({ g: t.g === null || t.g === undefined || t.g === "" ? null : +t.g, r: !!t.r }));
    fixTerms(o.cg);
    return o;
  }
  function load() {
    try { const v2 = JSON.parse(localStorage.getItem(STORE)); if (v2 && v2.courses) return norm(v2); } catch (e) { void e; }
    try { const v1 = JSON.parse(localStorage.getItem("gpa-scores")); if (v1 && Array.isArray(v1.courses)) return norm(G.migrateV1(v1)); } catch (e) { void e; }
    return norm({});
  }
  let S = load(), saveT = 0;
  const status = (t, bad) => { const s = $("status"); s.textContent = t; s.className = "foot " + (bad ? "fail" : "muted"); };
  function flush() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); status("Saved in this browser at " + hm() + ". Use Backup to keep a copy elsewhere."); }
    catch (e) { status("This browser blocks saving here. Use Backup to keep a copy.", true); }
  }
  function save() { S.savedAt = Date.now(); clearTimeout(saveT); saveT = setTimeout(flush, 300); }
  addEventListener("pagehide", () => { if (saveT) flush(); });

  const show = (p) => (S.scale.round ? G.rd(p, S.scale) : f1(p));
  const bandOf = (p) => G.band(p, S.scale);
  const gl = (b) => `${esc(b[1])} (${f2(b[2])})`;
  const top = () => G.maxPts(S.scale);
  const editing = new Set();
  let confirmDel = null, confirmReset = false;
  const courseOf = (el) => S.courses.find((c) => c.id === el.closest(".course")?.dataset.id);

  function renderLegend() {
    const rows = S.scale.rows;
    $("legend").innerHTML = `<span class="lbl">Grade scale · ${esc(S.scale.name)}</span>` +
      rows.map((r, i) => `<span class="lg"><b>${esc(r[1])}</b> = ${f2(r[2])} <small>${i === rows.length - 1 ? "below " + (rows[i - 1] ? rows[i - 1][0] : 0) + "%" : r[0] + "%+"}</small></span>`).join("") +
      (S.scale.round ? '<span class="lg"><small>Totals round to the nearest whole number first.</small></span>' : "");
  }
  function initSummary() {
    $("sum").innerHTML = `<div class="stat hero"><span class="lbl">GPA if you hit your goals</span><span class="v num" id="vGoal">–</span></div>
      <div class="stat"><span class="lbl">Best possible</span><span class="v num" id="vMax">–</span></div>
      <div class="stat"><span class="lbl">At current pace</span><span class="v num" id="vNow">–</span></div>
      <div class="stat"><label class="lbl" for="boost">Improved pace <select id="boost">${[3, 5, 10, 15].map((b) => `<option value="${b}">+${b} pts</option>`).join("")}</select></label><span class="v num" id="vImp">–</span></div>`;
  }
  function renderSummary() {
    const x = G.summarize(S.courses, S.scores, S.scale, S.goals, S.cg.boost);
    roll($("vGoal"), x.goal);
    roll($("vMax"), x.max);
    roll($("vNow"), x.now);
    roll($("vImp"), x.imp);
    $("boost").value = S.cg.boost;
    renderCg(S.courses.length ? x.goal : null);
  }

  function rowHTML(c, ci, ii, x) {
    const k = G.key(c.id, ci, ii), v = S.scores[k];
    return `<div class="row"><label for="i-${k}" title="${esc(x.n)}">${esc(x.n)}</label><input id="i-${k}" data-k="${k}" data-c="${c.id}" type="number" min="0" max="100" step="any" inputmode="decimal" value="${v ?? ""}" placeholder="—"><span class="hint" id="h-${k}"></span></div>`;
  }
  function partsHTML(c) {
    const r = G.calcCourse(c, S.scores, S.scale, S.goals);
    const out = c.comps.map((comp, ci) => (comp.items.length
      ? `<div class="part"><h3>${esc(comp.n)}<span>${f1(r.w[ci] * 100)}%</span></h3>${comp.items.map((x, ii) => rowHTML(c, ci, ii, x)).join("")}<div class="sub" id="s-${c.id}-${ci}"></div></div>` : "")).join("");
    return out || '<p class="muted" style="margin:0">No grading components yet. Press Edit to add them.</p>';
  }
  const cardHTML = (c) => `<article class="course" data-id="${c.id}">
    <div class="c-head"><div class="ct"><span class="tile" id="tl-${c.id}" style="--h:${hue(c.name)}">${esc(initials(c.name))}</span><div><h2 id="nm-${c.id}">${esc(c.name)}</h2><div class="cps"><span class="cp" id="cr-${c.id}"></span><span class="tagp" id="st-${c.id}" hidden></span></div></div></div>
      <div class="c-tools"><span class="now" id="now-${c.id}"></span><button class="btn" id="eb-${c.id}" data-act="toggleEdit" aria-expanded="false">Edit</button></div></div>
    <div id="edbox-${c.id}"></div>
    <div class="meter" id="mt-${c.id}" role="img"><div class="track"><div class="mf sec"></div><div class="mf pos"></div><span class="mk"></span></div><div class="mleg"></div></div>
    <div class="goal" id="goal-${c.id}"></div><div class="parts" id="parts-${c.id}"></div></article>`;

  function editorHTML(c) {
    return `<div class="ed"><div class="edtop">
      <label for="ed-${c.id}-name">Course name<input id="ed-${c.id}-name" data-ed="name" value="${esc(c.name)}"></label>
      <label for="ed-${c.id}-cr">Credits<input id="ed-${c.id}-cr" data-ed="cr" type="number" min="0" step="any" inputmode="decimal" value="${c.cr ?? 3}"></label></div>
      <div class="edcomps">${c.comps.map((comp, ci) => `<div class="edgrp"><div class="edhead">
        <label>Component<input data-ed="cn" data-ci="${ci}" value="${esc(comp.n)}"></label>
        <label>Weight %<input data-ed="cw" data-ci="${ci}" type="number" min="0" step="any" value="${comp.w}"></label>
        <label>Min %<input data-ed="cm" data-ci="${ci}" type="number" min="0" max="100" step="any" placeholder="none" value="${comp.min ?? ""}"></label>
        <button class="x" data-act="rmComp" data-ci="${ci}" aria-label="Remove ${esc(comp.n)}">×</button></div>
        ${comp.items.map((x, ii) => `<div class="edrow"><input data-ed="in" data-ci="${ci}" data-ii="${ii}" value="${esc(x.n)}" aria-label="Item name"><input data-ed="iw" data-ci="${ci}" data-ii="${ii}" type="number" min="0" step="any" value="${x.w}" aria-label="Item points"><button class="x" data-act="rmItem" data-ci="${ci}" data-ii="${ii}" aria-label="Remove ${esc(x.n)}">×</button></div>`).join("")}
        <button class="link" data-act="addItem" data-ci="${ci}">Add item</button></div>`).join("")}</div>
      <p class="foot">Weights are scaled to add up to 100, and item points are scaled inside each component. "Min %" is optional: finish a component below it and you are warned the course may fail.</p>
      <div class="actions"><button class="btn" data-act="addComp">Add component</button><button class="link bad" data-act="delCourse">${confirmDel === c.id ? "Click again to delete this course and its grades" : "Delete course"}</button></div></div>`;
  }

  function update(c) {
    const r = G.calcCourse(c, S.scores, S.scale, S.goals);
    c.comps.forEach((comp, ci) => {
      const el = $(`s-${c.id}-${ci}`);
      if (!el) return;
      const s = r.st[ci];
      el.innerHTML = s.graded
        ? `<span>${s.rest ? "So far" : "Total"}</span><span${r.fails[ci] ? ' class="fail"' : ""}><b>${f1(s.earned)}</b> / ${f1(s.graded)}${r.fails[ci] ? ` · below ${comp.min}, may fail` : ""}</span>`
        : '<span class="muted">Nothing graded yet</span>';
    });
    $("now-" + c.id).innerHTML = r.final !== null
      ? `Final grade <b>${show(r.final)}%</b> · ${gl(bandOf(r.final))}`
      : r.pace !== null ? `Now <b>${show(r.pace)}%</b> · ${gl(bandOf(r.pace))}` : "";
    const g = $("goal-" + c.id);
    const n = r.goal === null ? null : Math.max(0, Math.ceil(r.need(r.goal) - 1e-9));
    const live = c.comps.some((x) => x.items.length);
    const mt = $("mt-" + c.id), cut = r.goal === null ? null : G.cutoff(r.goal, S.scale);
    mt.hidden = !live;
    if (live) {
      mt.querySelector(".sec").style.width = Math.min(100, r.earned) + "%";
      const pos = mt.querySelector(".pos");
      pos.style.left = Math.min(100, r.earned) + "%";
      pos.style.width = Math.max(0, Math.min(100 - r.earned, r.rest)) + "%";
      const mk = mt.querySelector(".mk");
      mk.hidden = cut === null;
      if (cut !== null) mk.style.left = Math.min(100, cut) + "%";
      mt.querySelector(".mleg").innerHTML = `<span><i class="dot sec"></i>Secured <b>${f1(r.earned)}</b></span><span><i class="dot pos"></i>Still possible <b>${f1(r.rest)}</b></span>` + (cut === null ? "" : `<span><i class="dot mk"></i>Goal line <b>${f1(cut)}</b></span>`);
      mt.setAttribute("aria-label", `Secured ${f1(r.earned)} out of 100, ${f1(r.rest)} still possible` + (cut === null ? "" : `, goal line at ${f1(cut)}`));
    }
    const stat = !live ? null : r.final !== null ? ["Done", "t-ok"] : r.goal === null ? ["Out of reach", "t-no"] : n <= 0 ? ["Secured", "t-ok"] : n >= 90 ? ["Tough", "t-hard"] : ["On track", "t-ok"];
    const stEl = $("st-" + c.id);
    stEl.hidden = !stat;
    stEl.textContent = stat ? stat[0] : "";
    stEl.className = "tagp " + (stat ? stat[1] : "");
    $("cr-" + c.id).textContent = `${c.cr ?? 3} credits`;
    if (!c.comps.some((x) => x.items.length)) g.innerHTML = '<p class="muted">Add grading components to see the score you need.</p>';
    else if (r.final !== null) { const b = bandOf(r.final); g.innerHTML = `<p class="msg">Course finished: <b>${show(r.final)}%</b>, ${esc(b[1])} (${f2(b[2])}).</p>`; }
    else if (r.goal === null) g.innerHTML = `<p class="fail">Even full marks on everything left cannot reach ${esc(S.scale.rows[S.scale.rows.length - 2]?.[1] ?? "a pass")} in this course.</p>`;
    else {
      const gb = bandOf(r.goal);
      g.innerHTML = `<p class="msg">${r.goal === r.best ? "Highest grade you can still get" : "Your goal"}: <b>${esc(gb[1])}</b>, GPA <b>${f2(gb[2])}</b>, which needs a course total of ${G.cutoff(r.goal, S.scale)}% or more. ` +
        (n <= 0 ? "Already secured, whatever you score next." : `Score at least <b>${n}</b> on every remaining item.`) + `</p>
        <div class="pills seg" role="group" aria-label="Pick a goal grade">${r.reach.map(([t, l, p]) => { const s = r.need(t) <= 0;
          return `<button class="pill${t === r.goal ? " on" : ""}${s ? " done" : ""}" data-goal="${t}" aria-pressed="${t === r.goal}">${esc(l)}<span class="pp">${f2(p)}</span><small>${s ? "secured" : "need " + Math.ceil(r.need(t) - 1e-9)}</small></button>`; }).join("")}</div>`;
      glide(g.querySelector(".seg"), "goal-" + c.id);
    }
    c.comps.forEach((comp, ci) => comp.items.forEach((x, ii) => {
      const h = $("h-" + G.key(c.id, ci, ii));
      if (!h) return;
      if (G.score(S.scores, c.id, ci, ii) !== null || n === null) { h.textContent = ""; return; }
      h.textContent = n <= 0 ? "any" : "need " + n;
      h.classList.toggle("hard", n >= 90);
    }));
  }
  const paint = (c) => { $("parts-" + c.id).innerHTML = partsHTML(c); update(c); };
  function paintEd(c) {
    const on = editing.has(c.id);
    $("edbox-" + c.id).innerHTML = on ? editorHTML(c) : "";
    const b = $("eb-" + c.id);
    b.textContent = on ? "Done" : "Edit";
    b.setAttribute("aria-expanded", on);
  }

  const termNo = (i) => S.cg.terms.slice(0, i + 1).filter((x) => x.r === S.cg.terms[i].r).length;
  const termName = (i) => (S.cg.terms[i].r ? `Retake ${termNo(i)}` : `Term ${termNo(i)}`);
  const termYear = (i) => (S.cg.terms[i].r ? "retake" : `Year ${Math.ceil(termNo(i) / S.cg.perYear)}`);
  function renderPast() {
    const cg = S.cg, T = top();
    const chips = [0.75, 0.875, 0.925, 0.975, 1].map((f) => Math.round(T * f * 100) / 100);
    $("past").innerHTML = `<div class="tgt">
      <div class="tgt-main"><label class="lbl" for="cgTarget">Target CGPA</label>
        <div class="stepper"><button id="tgtDown" aria-label="Lower the target by 0.05">−</button><input id="cgTarget" type="number" min="0" max="${T}" step="0.05" inputmode="decimal" value="${(+cg.target).toFixed(2)}"><button id="tgtUp" aria-label="Raise the target by 0.05">+</button></div>
        <div class="chips seg" id="segT" role="group" aria-label="Quick targets">${chips.map((v) => `<button class="chip${Math.abs(v - cg.target) < 1e-9 ? " on" : ""}" data-tgt="${v}">${v.toFixed(2)}</button>`).join("")}</div></div>
      <div class="tgt-main"><span class="lbl">Reach it by the end of</span>
        <div class="chips seg" id="segY" role="group" aria-label="Deadline">${[1, 2, 3, 4, 5, 6].map((y) => `<button class="chip${cg.years === y ? " on" : ""}" data-years="${y}">Year ${y}</button>`).join("")}</div></div>
      <div class="mini"><label>Terms per year<input id="perYear" type="number" min="1" max="6" value="${cg.perYear}"></label></div></div>
      <div class="terms-box"><span class="lbl">Your terms: type the GPA you got, leave blank if it has not happened yet</span>
      <div class="terms">${cg.terms.map((t, i) => `<div class="term${t.r ? " rtk" : ""}"><label for="tg-${i}">${termName(i)}<small>${termYear(i)}</small><input id="tg-${i}" data-term="${i}" type="number" min="0" max="${T}" step="0.01" inputmode="decimal" placeholder="not yet" value="${t.g ?? ""}"></label><button class="x" data-rm="${i}" aria-label="Remove ${termName(i)}">×</button></div>`).join("")}</div>
      <div class="actions"><button class="btn" id="addRetake">Add retake term</button></div></div>`;
    glide($("segT"), "segT");
    glide($("segY"), "segY");
  }
  const tagHTML = (n) => (n <= 0 ? '<span class="tagp t-ok">already there</span>' : n > top() + 1e-9 ? '<span class="tagp t-no">not possible</span>' : n >= top() - 0.15 ? '<span class="tagp t-hard">tough</span>' : '<span class="tagp t-ok">doable</span>');
  function renderCg(cur) {
    const cg = S.cg, T = +cg.target, tp = top();
    const p = G.cgPlan(cg.terms, T, cur ?? 0, tp);
    $("cgNow").textContent = p.k ? f2(p.sum / p.k) : "–";
    $("cgDone").textContent = p.k;
    if (cur === null) { $("cgOut").innerHTML = '<p class="muted" style="margin:0">Add a course to see how this term changes your CGPA.</p>'; return; }
    if (p.ci < 0) { $("cgOut").innerHTML = `<p class="tgt-line">Every term in your list has a GPA, so your CGPA is <b class="num">${f2(p.now)}</b>, which ${p.now >= T - 1e-9 ? "reaches" : "is below"} your target of ${f2(T)}. Add a term or a retake term to plan more.</p>`; return; }
    const head = `<p class="lbl" style="margin:0 0 4px">You are in ${termName(p.ci).toLowerCase()}${cg.terms[p.ci].r ? "" : ", " + termYear(p.ci)}</p><p class="tgt-line">` + (p.L <= 0
      ? `After this term your CGPA will be <b class="num">${f2(p.after)}</b>, ${p.after >= T - 1e-9 ? "which reaches" : "which is below"} your target of ${f2(T)}.`
      : p.a <= 0 ? `Your target of ${f2(T)} is already secured, whatever you score in the next ${p.L} terms.`
      : p.a > tp + 1e-9 ? `${f2(T)} is out of reach with the grades you are aiming for this term. The best you could end with is <b class="num">${f2(p.best)}</b>.`
      : `To reach ${f2(T)} you need about <b class="num">${f2(p.a)}</b> in each of the next ${p.L} terms. ${tagHTML(p.a)}`) + "</p>";
    const st = { done: '<span class="tagp t-ok">done</span>', now: '<span class="tagp t-ok">this term</span>' };
    const rows = p.rows.map((r, i) => `<tr><td class="big">${cg.terms[i].r ? "R" : ""}${termNo(i)}<small>${termYear(i)}</small></td><td class="num">${r.g > tp + 1e-9 ? "over " + f2(tp) : f2(r.g)}</td><td class="num">${r.floor === null ? "—" : r.floor > tp + 1e-9 ? "over " + f2(tp) : f2(r.floor)}</td><td>${st[r.st] || tagHTML(r.g)}</td></tr>`).join("");
    $("cgOut").innerHTML = head + `<table class="cgt"><thead><tr><th>Term</th><th>GPA to stay on pace for ${f2(T)}</th><th>Absolute minimum</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p class="foot" style="margin:6px 0 12px">On pace = what each term still to come must average to land on ${f2(T)}, given your goals this term. Minimum = the lowest you can score that term and still make it, if every later term is ${f2(tp)}. ${p.pass ? "" : '<b class="fail">Target not reachable with current goals.</b>'}</p>
      <p style="margin:0 0 10px">If you hit your goals this term, you get <b class="num">${f2(cur)}</b> and your CGPA becomes <b class="num">${f2(p.after)}</b>.</p>`;
  }

  function renderEmpty() {
    const e = $("empty");
    e.hidden = S.courses.length > 0;
    if (!e.hidden) e.innerHTML = `<h2>Start here</h2><p class="muted" style="margin:0;max-width:60ch">Add your courses, type your grades as you get them, and see the score you need on everything that is left. The fastest way in is to import a syllabus or your Moodle grades.</p>
      <div class="actions"><button class="btn primary" data-go="import">Import syllabus or Moodle</button><button class="btn" data-go="add">Add a course by hand</button><button class="btn" data-go="example">Try example courses</button></div>`;
  }
  function renderAll() {
    renderEmpty();
    renderPast();
    $("list").innerHTML = S.courses.map(cardHTML).join("");
    S.courses.forEach((c) => { paintEd(c); paint(c); });
    renderLegend();
    renderSummary();
    $("foot").textContent = "Each course total = the weighted average of its components, using the grading scale above. The goal starts at the highest grade you can still reach; tap another grade to plan for it. Needed scores assume the same score on every remaining item, rounded up. Courses are averaged by their credits, and CGPA treats every term as the same size.";
  }

  const gridOf = (c) => c.comps.map((comp, ci) => comp.items.map((x, ii) => S.scores[G.key(c.id, ci, ii)]));
  function putGrid(c, grid) {
    for (const k of Object.keys(S.scores)) if (k.startsWith(c.id + "|")) delete S.scores[k];
    grid.forEach((row, ci) => row.forEach((v, ii) => { if (v !== undefined && v !== null && v !== "") S.scores[G.key(c.id, ci, ii)] = v; }));
  }
  const newCourse = (name, comps, cr) => { const c = { id: uid(), name, cr: cr ?? 3, comps }; S.courses.push(c); return c; };
  function addByHand() {
    const c = newCourse("New course", [G.mkComp("Assignments", 30, 4), G.mkComp("Midterm exam", 30, 1), G.mkComp("Final exam", 40, 1)]);
    editing.add(c.id);
    renderAll();
    save();
    const nm = $(`ed-${c.id}-name`);
    nm.scrollIntoView({ block: "center" });
    nm.select();
  }
  function loadExample() {
    newCourse("Introduction to Programming", [G.mkComp("Assignments", 30, 5), G.mkComp("Midterm exam", 30, 1), G.mkComp("Final exam", 40, 1)], 4);
    newCourse("Calculus I", [G.mkComp("Quizzes", 20, 4), G.mkComp("Midterm exam", 30, 1), G.mkComp("Final exam", 50, 1)], 3);
    renderAll();
    save();
  }

  $("sum").addEventListener("change", (e) => { if (e.target.id === "boost") { S.cg.boost = +e.target.value; renderSummary(); save(); } });
  $("list").addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset.k) return;
    S.scores[t.dataset.k] = t.value === "" ? null : +t.value;
    const c = S.courses.find((x) => x.id === t.dataset.c);
    update(c);
    renderSummary();
    save();
  });
  $("list").addEventListener("change", (e) => {
    const t = e.target, ed = t.dataset.ed;
    if (!ed) return;
    const c = courseOf(t);
    const ci = +t.dataset.ci, ii = +t.dataset.ii;
    if (ed === "name") {
      c.name = t.value.trim() || "Untitled course";
      $("nm-" + c.id).textContent = c.name;
      $("tl-" + c.id).textContent = initials(c.name);
      $("tl-" + c.id).style.setProperty("--h", hue(c.name));
    }
    else if (ed === "cr") c.cr = t.value === "" ? 3 : Math.max(0, +t.value || 0);
    else if (ed === "cn") c.comps[ci].n = t.value.trim() || "Component";
    else if (ed === "cw") c.comps[ci].w = Math.max(0, +t.value || 0);
    else if (ed === "cm") { if (t.value === "") delete c.comps[ci].min; else c.comps[ci].min = Math.min(100, Math.max(0, +t.value || 0)); }
    else if (ed === "in") c.comps[ci].items[ii].n = t.value.trim() || "Item";
    else if (ed === "iw") c.comps[ci].items[ii].w = Math.max(0, +t.value || 0);
    paint(c);
    renderSummary();
    save();
  });
  $("list").addEventListener("click", (e) => {
    const g = e.target.closest("[data-goal]");
    if (g) { const c = courseOf(g); S.goals[c.id] = +g.dataset.goal; update(c); renderSummary(); save(); return; }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const c = courseOf(b), a = b.dataset.act, ci = +b.dataset.ci, ii = +b.dataset.ii;
    if (a === "toggleEdit") { editing.has(c.id) ? editing.delete(c.id) : editing.add(c.id); confirmDel = null; paintEd(c); return; }
    if (a === "addItem") c.comps[ci].items.push({ n: "New item", w: 0 });
    else if (a === "addComp") c.comps.push({ n: "New component", w: 0, items: [{ n: "Item", w: 100 }] });
    else if (a === "rmItem") { const gr = gridOf(c); gr[ci].splice(ii, 1); c.comps[ci].items.splice(ii, 1); putGrid(c, gr); }
    else if (a === "rmComp") { const gr = gridOf(c); gr.splice(ci, 1); c.comps.splice(ci, 1); putGrid(c, gr); }
    else if (a === "delCourse") {
      if (confirmDel !== c.id) { confirmDel = c.id; paintEd(c); return; }
      S.courses = S.courses.filter((x) => x !== c);
      for (const k of Object.keys(S.scores)) if (k.startsWith(c.id + "|")) delete S.scores[k];
      delete S.goals[c.id];
      editing.delete(c.id);
      confirmDel = null;
      renderAll();
      save();
      return;
    }
    paintEd(c);
    paint(c);
    renderSummary();
    save();
  });

  $("past").addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "cgTarget") S.cg.target = Math.min(top(), Math.max(0, +t.value || 0));
    else if (t.dataset.term !== undefined) S.cg.terms[+t.dataset.term].g = t.value === "" ? null : Math.min(top(), Math.max(0, +t.value));
    else return;
    renderSummary();
    save();
  });
  function setTarget(v) { S.cg.target = Math.min(top(), Math.max(0, Math.round(v * 100) / 100)); renderPast(); renderSummary(); save(); }
  $("past").addEventListener("click", (e) => {
    const t = e.target;
    const rm = t.closest("[data-rm]");
    if (rm) { S.cg.terms.splice(+rm.dataset.rm, 1); renderPast(); renderSummary(); save(); return; }
    if (t.id === "addRetake") { S.cg.terms.push({ g: null, r: true }); renderPast(); renderSummary(); save(); $("tg-" + (S.cg.terms.length - 1))?.focus(); return; }
    const yr = t.closest("[data-years]");
    if (yr) { S.cg.years = +yr.dataset.years; fixTerms(S.cg); renderPast(); renderSummary(); save(); return; }
    const chip = t.closest("[data-tgt]");
    if (chip) setTarget(+chip.dataset.tgt);
    else if (t.id === "tgtUp") setTarget(S.cg.target + 0.05);
    else if (t.id === "tgtDown") setTarget(S.cg.target - 0.05);
  });
  $("past").addEventListener("change", (e) => {
    if (e.target.id !== "perYear") return;
    S.cg.perYear = Math.min(6, Math.max(1, Math.round(+e.target.value) || 2));
    fixTerms(S.cg);
    renderPast();
    renderSummary();
    save();
  });

  const dlg = $("dlg");
  function openDlg(title, html) { $("dlgTitle").textContent = title; $("dlgBody").innerHTML = html; if (!dlg.open) dlg.showModal(); }
  $("dlgX").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  let sy = null, mo = null, tab = "syllabus";
  const sumComps = (d) => G.round2(d.comps.reduce((a, c) => a + (+c.w || 0), 0));
  function sylHTML() {
    const s = sy;
    return `<p class="${s.exact ? "ok" : "fail"}" style="margin:0">${s.exact ? "Found a grading table that adds up to 100%. Check it, then create the course." : s.comps.length ? "Could not find a table that adds up to 100%. Fix the numbers below." : "No grading percentages found. Paste the grading section as text, or add the components by hand."}</p>
      <div class="edtop"><label>Course name<input id="sylName" class="ctl" data-d="name" value="${esc(s.name)}"></label><label>Credits<input data-d="cr" type="number" min="0" step="any" value="${s.cr}"></label></div>
      <table class="dt"><thead><tr><th>Component</th><th>Weight %</th><th>Items</th><th></th></tr></thead><tbody>${s.comps.map((c, i) => `<tr><td><input data-d="cn" data-i="${i}" value="${esc(c.n)}" aria-label="Component name"></td><td><input class="n" data-d="cw" data-i="${i}" type="number" min="0" step="any" value="${c.w}" aria-label="Weight"></td><td><input class="n" data-d="ck" data-i="${i}" type="number" min="1" max="30" value="${c.items.length}" aria-label="Number of items"></td><td><button class="x" data-act="dRm" data-i="${i}" aria-label="Remove">×</button></td></tr>`).join("")}</tbody></table>
      <p class="foot" style="margin:0">Total: <b id="sylSum">${sumComps(s)}</b>% <button class="link" data-act="dAdd">Add component</button></p>
      ${s.scale ? `<label class="chk"><input type="checkbox" id="useScale" checked><span>Also use the grade scale found in this file: ${s.scale.rows.map((r) => `${esc(r[1])} ${r[0]}%+`).join(", ")}</span></label>` : ""}
      <div class="actions"><button class="btn primary" data-act="sylCreate"${s.comps.length ? "" : " disabled"}>Create course</button></div>`;
  }
  function moHTML() {
    const m = mo;
    const opts = S.courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
    return `<p class="${m.count ? "ok" : "fail"}" style="margin:0">${m.count ? `Read ${m.count} grade rows (${Object.keys(m.scores).length} with a grade).` : "No grade rows found. Check what you pasted."}</p>
      <table class="dt"><thead><tr><th>Component</th><th>Weight %</th><th>Items</th></tr></thead><tbody>${m.comps.map((c) => `<tr><td>${esc(c.n)}</td><td class="num">${c.w}</td><td class="num">${c.items.length}</td></tr>`).join("")}</tbody></table>
      <label class="chk"><input type="radio" name="moMode" value="new"${S.courses.length ? "" : " checked"}><span>Add as a new course named <input class="ctl" id="moName" value="${esc(m.name)}"></span></label>
      ${S.courses.length ? `<label class="chk"><input type="radio" name="moMode" value="fill" checked><span>Fill the grades into an existing course (matched by item name): <select class="ctl" id="moCourse">${opts}</select></span></label>` : ""}
      <div class="actions"><button class="btn primary" data-act="moApply"${m.count ? "" : " disabled"}>Apply</button><span class="foot" id="moRes"></span></div>`;
  }
  function importHTML() {
    const t = (id, label) => `<button class="tab${tab === id ? " on" : ""}" role="tab" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`;
    const head = `<div class="tabs seg" role="tablist">${t("syllabus", "From a syllabus")}${t("moodle", "From Moodle grades")}</div>`;
    if (tab === "syllabus") return head + `<label class="drop" id="drop"><input type="file" id="file" accept=".pdf,.docx,.txt,.md,.text"><b>Drop your syllabus here, or click to choose</b><span class="muted">PDF, Word (.docx) or text. It is read in your browser and never uploaded.</span></label>
      <label class="foot" for="syltxt" style="margin:0">Or paste the grading section as text</label><textarea id="syltxt" placeholder="Assignments 20%&#10;Midterm 30%&#10;Final exam 50%"></textarea>
      <div class="actions"><button class="btn primary" data-act="sylDo">Find the grading table</button><span class="foot" id="sylMsg"></span></div><div id="sylOut" style="display:grid;gap:12px">${sy ? sylHTML() : ""}</div>`;
    return head + `<ol class="steps"><li>Open Moodle, go to <b>Grades</b> for your course and pick the <b>User report</b>.</li><li>Click the <b>Grab Moodle grades</b> bookmark (drag the button below to your bookmarks bar once), or just select the grades table on the page and copy it.</li><li>Paste it here.</li></ol>
      <div class="actions"><a class="btn" id="bm" href="#" draggable="true">Grab Moodle grades</a><button class="link" data-act="bmCopy">Copy the bookmark code instead</button></div>
      <p class="foot" style="margin:0">It runs inside your own logged-in Moodle page, so your password never goes anywhere. Moodle themes differ, so if the bookmark finds nothing, copy and paste the table instead.</p>
      <textarea id="motxt" placeholder="Paste your Moodle grades here"></textarea>
      <div class="actions"><button class="btn primary" data-act="moDo">Read grades</button></div><div id="moOut" style="display:grid;gap:12px">${mo ? moHTML() : ""}</div>`;
  }
  function openImport() {
    tab = "syllabus";
    openDlg("Import your courses", importHTML());
    const bm = $("bm");
    if (bm) bm.setAttribute("href", BOOKMARKLET);
    glide($("dlgBody").querySelector(".tabs"), "tabs");
  }

  const loadScript = (src) => new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => no(new Error("Could not load " + src));
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
  async function readFile(file) {
    const n = file.name.toLowerCase();
    if (n.endsWith(".pdf")) {
      const base = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
      if (!window.pdfjsLib) await loadScript(base + "pdf.min.js");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js";
      const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const out = [];
      for (let p = 1; p <= doc.numPages; p++) out.push(pdfText((await (await doc.getPage(p)).getTextContent()).items));
      return out.join("\n");
    }
    if (n.endsWith(".docx")) {
      if (!window.mammoth) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
      return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    }
    return file.text();
  }
  function detect(text, name) {
    sy = G.parseSyllabus(text, name);
    $("sylOut").innerHTML = sylHTML();
  }
  async function takeFile(file) {
    const msg = $("sylMsg");
    msg.className = "foot";
    msg.innerHTML = `<span class="shimmer"></span> Reading ${esc(file.name)}…`;
    try {
      const text = await readFile(file);
      $("syltxt").value = text;
      msg.textContent = "";
      detect(text, file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    } catch (err) { msg.textContent = "Could not read that file (" + (err.message || err) + "). Paste the text instead."; msg.className = "foot fail"; }
  }

  function scaleHTML(d) {
    return `<label class="foot" for="presetSel" style="margin:0">Start from a preset</label><select class="ctl" id="presetSel"><option value="">Choose…</option>${Object.entries(G.PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join("")}</select>
      <label class="chk"><input type="checkbox" id="sclRound"${d.round ? " checked" : ""}><span>Round the course total to the nearest whole number before grading (94.5 counts as 95)</span></label>
      <div class="scl"><div class="r lbl"><span>From %</span><span>Letter</span><span>GPA points</span><span></span></div>${d.rows.map((r, i) => `<div class="r"><input data-s="0" data-i="${i}" type="number" step="any" value="${r[0]}" aria-label="Minimum percent"><input class="l" data-s="1" data-i="${i}" value="${esc(r[1])}" aria-label="Letter"><input data-s="2" data-i="${i}" type="number" step="any" value="${r[2]}" aria-label="Points"><button class="x" data-act="sRm" data-i="${i}" aria-label="Remove row">×</button></div>`).join("")}</div>
      <div class="actions"><button class="btn" data-act="sAdd">Add row</button><button class="btn primary" data-act="sSave">Save scale</button></div>`;
  }
  let sd = null;
  const openScale = () => { sd = JSON.parse(JSON.stringify(S.scale)); openDlg("Grading scale", scaleHTML(sd)); };

  function backupText() { return JSON.stringify(S, null, 1); }
  const openBackup = () => openDlg("Backup and restore", `<p class="foot" style="margin:0">Your data lives only in this browser. Copy or download it to keep a safe copy or move to another device, and paste it back to restore. Backups from the older GPA Planner artifact work too.</p>
    <textarea id="bk" spellcheck="false" aria-label="Backup text">${esc(backupText())}</textarea>
    <div class="actions"><button class="btn" data-act="bkCopy">Copy</button><button class="btn" data-act="bkDownload">Download file</button><button class="btn primary" data-act="bkRestore">Restore from this text</button><span class="foot" id="bkMsg"></span></div>`);

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
    if (a === "sylDo") { const txt = $("syltxt").value.trim(); if (txt) detect(txt, sy?.name && sy.name !== "New course" ? sy.name : ""); else $("sylMsg").textContent = "Choose a file or paste some text first."; }
    else if (a === "dRm") { sy.comps.splice(i, 1); $("sylOut").innerHTML = sylHTML(); }
    else if (a === "dAdd") { sy.comps.push(G.mkComp("New component", 0, 1)); $("sylOut").innerHTML = sylHTML(); }
    else if (a === "sylCreate") {
      const c = newCourse(sy.name || "New course", sy.comps, sy.cr);
      if (sy.scale && $("useScale")?.checked) { S.scale = sy.scale; S.goals = {}; }
      sy = null;
      dlg.close();
      renderAll();
      save();
      status("Added " + c.name + ". Type your grades as you get them.");
    }
    else if (a === "bmCopy") { navigator.clipboard?.writeText(BOOKMARKLET).then(() => { t.textContent = "Copied. Make a new bookmark and paste this as its address."; }, () => { t.textContent = "Copy failed in this browser."; }); }
    else if (a === "moDo") { const txt = $("motxt").value.trim(); if (txt) { mo = G.parseMoodle(txt); $("moOut").innerHTML = moHTML(); } }
    else if (a === "moApply") {
      const mode = dlg.querySelector("input[name=moMode]:checked")?.value || "new";
      if (mode === "fill") {
        const c = S.courses.find((x) => x.id === $("moCourse").value);
        const r = G.fillScores(c, S.scores, mo);
        $("moRes").textContent = `Filled ${r.filled} grades.` + (r.unmatched.length ? ` Could not match: ${r.unmatched.join(", ")}.` : "");
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
        status("Added " + c.name + " with your Moodle grades.");
      }
    }
    else if (a === "sRm") { sd.rows.splice(i, 1); $("dlgBody").innerHTML = scaleHTML(sd); }
    else if (a === "sAdd") { sd.rows.splice(Math.max(0, sd.rows.length - 1), 0, [0, "?", 0]); $("dlgBody").innerHTML = scaleHTML(sd); }
    else if (a === "sSave") { S.scale = G.normScale(sd); S.goals = {}; for (const t2 of S.cg.terms) if (t2.g !== null) t2.g = Math.min(t2.g, top()); dlg.close(); renderAll(); save(); }
    else if (a === "bkCopy") { const v = $("bk").value; navigator.clipboard?.writeText(v).then(() => { $("bkMsg").textContent = "Copied."; }, () => { $("bk").select(); $("bkMsg").textContent = "Select the text and copy it yourself."; }); }
    else if (a === "bkDownload") {
      const url = URL.createObjectURL(new Blob([$("bk").value], { type: "application/json" }));
      const l = document.createElement("a");
      l.href = url;
      l.download = "gpa-planner-backup.json";
      l.click();
      URL.revokeObjectURL(url);
    }
    else if (a === "bkRestore") {
      try {
        const j = JSON.parse($("bk").value);
        if (!j || !Array.isArray(j.courses)) throw new Error("bad");
        S = norm(j.courses[0] && j.courses[0].mid ? G.migrateV1(j) : j);
        editing.clear();
        dlg.close();
        renderAll();
        flush();
        status("Restored from your backup.");
      } catch (err) { $("bkMsg").textContent = "That text is not a valid backup."; $("bkMsg").className = "foot fail"; }
    }
  });
  $("dlgBody").addEventListener("input", (e) => {
    const t = e.target, d = t.dataset.d, i = +t.dataset.i;
    if (d && sy) {
      if (d === "name") sy.name = t.value;
      else if (d === "cr") sy.cr = Math.max(0, +t.value || 0);
      else if (d === "cn") sy.comps[i].n = t.value;
      else if (d === "cw") { sy.comps[i].w = Math.max(0, +t.value || 0); }
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
  });
  $("dlgBody").addEventListener("dragover", (e) => { if (e.target.closest("#drop")) { e.preventDefault(); $("drop").classList.add("over"); } });
  $("dlgBody").addEventListener("dragleave", () => $("drop")?.classList.remove("over"));
  $("dlgBody").addEventListener("drop", (e) => { if (e.target.closest("#drop")) { e.preventDefault(); $("drop").classList.remove("over"); if (e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]); } });

  $("openImport").addEventListener("click", openImport);
  $("openScale").addEventListener("click", openScale);
  $("openBackup").addEventListener("click", openBackup);
  $("addCourse").addEventListener("click", addByHand);
  $("loadExample").addEventListener("click", loadExample);
  $("empty").addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]")?.dataset.go;
    if (g === "import") openImport();
    else if (g === "add") addByHand();
    else if (g === "example") loadExample();
  });
  $("resetBtn").addEventListener("click", () => {
    const b = $("resetBtn");
    if (!confirmReset) { confirmReset = true; b.textContent = "Click again: this deletes all your courses, grades and terms"; return; }
    S = norm({});
    editing.clear();
    confirmReset = false;
    b.textContent = "Delete everything";
    renderAll();
    save();
  });

  initSummary();
  renderAll();
  status(S.savedAt ? "Loaded your saved courses." : "Nothing saved yet. Your work is saved in this browser as you type.");
})();
