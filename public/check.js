/* ---------- revisões: checklists por tipo de equipamento ----------
   Tudo fica em state.check.items, com k:"type" (modelo de checklist) ou k:"rec" (revisão feita),
   para sincronizar item a item com o servidor, igual ao estoque e às manutenções. */
const ANS = { ok:["✔ OK", "ok"], nc:["⚠ Problema", "bad"], na:["➖ N/A", "mute"] };
const ansLabel = { ok:"OK / padrão", nc:"Problema", na:"Não se aplica" };

function normCheck(c){
  c = Object.assign({ name:"Revisões", role:"Checklists de equipamentos", items:[], moves:[] }, c);
  c.items = (c.items || []).map(i => i.k === "rec"
    ? { id:i.id || uid(), k:"rec", tid:i.tid || "", tname:i.tname || "Equipamento", ident:i.ident || "", loc:i.loc || "",
        pts:Array.isArray(i.pts) ? i.pts : [], ans:i.ans || {}, status:i.status === "concluida" ? "concluida" : "andamento", obs:i.obs || "",
        os:i.os || "", osn:+i.osn || 0, sd:i.sd || new Date().toISOString(), ed:i.ed || "", by:i.by || "Eu", c:+i.c || 0, u:+i.u || 0, ub:i.ub || "" }
    : { id:i.id || uid(), k:"type", name:i.name || "Equipamento", pts:Array.isArray(i.pts) ? i.pts : [], c:+i.c || 0, u:+i.u || 0, ub:i.ub || "" });
  c.del = c.del || {};
  return c;
}
const kTypes = () => state.check.items.filter(i => i.k === "type").sort((a, b) => a.name.localeCompare(b.name));
const kRecs = () => state.check.items.filter(i => i.k === "rec").sort((a, b) => b.sd.localeCompare(a.sd));
function recStats(r){
  let ok = 0, nc = 0, na = 0;
  r.pts.forEach(p => { const a = r.ans[p.id]; if (a && a.s === "ok") ok++; else if (a && a.s === "nc") nc++; else if (a && a.s === "na") na++; });
  return { ok, nc, na, pend:r.pts.length - ok - nc - na, total:r.pts.length };
}
function checkStats(c){
  const mk = monthKey(new Date());
  const recs = c.items.filter(i => i.k === "rec"), mrec = recs.filter(r => r.sd.startsWith(mk));
  const done = mrec.filter(r => r.status === "concluida");
  const withNc = recs.filter(r => r.status === "concluida" && recStats(r).nc > 0);
  const conforme = done.filter(r => recStats(r).nc === 0).length;
  return { types:c.items.filter(i => i.k === "type").length, month:mrec.length, doing:recs.filter(r => r.status === "andamento").length,
    conforme, problemas:done.length - conforme, pendOS:withNc.filter(r => !r.os).length, pct:done.length ? Math.round(conforme / done.length * 100) : 0 };
}
const kfmt = s => s ? fmtDT(s) : "—";

/* ---------- tela principal ---------- */
function checkHtml(c){
  if (ui.kOpen) { const r = c.items.find(x => x.id === ui.kOpen); if (r) return recDetail(r); ui.kOpen = null; }
  if (ui.kType) { const t = c.items.find(x => x.id === ui.kType); if (t) return typeDetail(t); ui.kType = null; }
  const k = checkStats(c);
  const kp = (l, v, cl = "") => `<div class="kpi ${cl}"><small>${l}</small><b>${v}</b></div>`;
  let h = `<div class="kpis">${kp("Revisões no mês", k.month)}${kp("Em andamento", k.doing)}${kp("Conformes (mês)", k.pct + "%")}
    ${kp("Com problemas (mês)", k.problemas, k.problemas ? "warn" : "")}${kp("Sem OS aberta", k.pendOS, k.pendOS ? "warn" : "")}${kp("Equipamentos cadastrados", k.types)}</div>`;
  h += `<div class="tabs"><button data-act="ktab" data-t="rev" class="${ui.kt === "rev" ? "on" : ""}">Revisões</button>
    <button data-act="ktab" data-t="mod" class="${ui.kt === "mod" ? "on" : ""}">Equipamentos</button></div>`;
  if (ui.kt === "mod") {
    h += `<div class="addform"><span class="meta" style="flex:1;align-self:center">Cadastre cada equipamento com o checklist dele. Cada equipamento tem os seus próprios itens.</span>
      <button class="btn primary" data-act="knewtype">${ui.kNewType ? "Fechar" : "+ Novo equipamento"}</button></div>`;
    if (ui.kNewType) h += `<form class="pf" data-form="ktype">
      <label class="fld wide">Nome do equipamento *<input type="text" name="text" required placeholder="Ex.: Betoneira, Compactador, Andaime…"></label>
      <label class="fld wide">Itens do checklist (um por linha)<textarea name="pts" rows="6" placeholder="Estado do motor&#10;Nível de óleo&#10;Correia e polias&#10;Proteções e carenagens&#10;Cabo de energia e plugue"></textarea></label>
      <div class="bt"><button type="button" class="btn" data-act="knewtype">Cancelar</button><button type="submit" class="btn primary">Cadastrar equipamento</button></div></form>`;
    const ts = kTypes();
    h += ts.length ? `<ul>${ts.map(t => `<li class="clk" data-act="ktopen" data-id="${t.id}"><div class="t"><b>${esc(t.name)}</b>
      <small>${t.pts.length} item${t.pts.length === 1 ? "" : "s"} no checklist · ${kRecs().filter(r => r.tid === t.id).length} revisão(ões) feita(s)</small></div><span class="meta">abrir ›</span></li>`).join("")}</ul>`
      : `<div class="empty">Nenhum equipamento cadastrado.<br>Cadastre o primeiro, por exemplo “Betoneira”.</div>`;
    return h;
  }
  h += `<div class="addform"><input type="text" data-f="kq" placeholder="Buscar nas revisões: equipamento, número, local…" value="${esc(ui.kq)}" autocomplete="off">
    <select data-f="kf" aria-label="Equipamento"><option value="">Todos os equipamentos</option>${kTypes().map(t => `<option value="${t.id}" ${t.id === ui.kfT ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
    <button class="btn primary" data-act="knew">${ui.kNew ? "Fechar" : "+ Nova revisão"}</button></div>`;
  if (ui.kNew) h += newRecForm();
  return h + `<div id="klist">${checkList()}</div>`;
}

function pickList(){
  const q = ui.ks.trim().toLowerCase();
  const ts = kTypes().filter(t => !q || t.name.toLowerCase().includes(q));
  return ts.map(t => `<button type="button" class="kopt" data-act="kpick" data-id="${t.id}"><b>${esc(t.name)}</b><small>${t.pts.length} itens no checklist</small></button>`).join("")
    || `<div class="empty" style="padding:10px 0">Nenhum equipamento encontrado.</div>`;
}

function newRecForm(){
  if (!kTypes().length) return `<div class="warn">Antes de fazer uma revisão, cadastre o equipamento e o checklist dele na aba “Equipamentos”.</div>`;
  const t = ui.kPick && state.check.items.find(x => x.id === ui.kPick);
  if (!t) return `<div class="pf"><label class="fld wide">Buscar equipamento<input type="text" data-f="ks" placeholder="Digite: betoneira, compactador…" value="${esc(ui.ks)}" autocomplete="off"></label>
    <div class="fld wide kpick" id="kpick">${pickList()}</div></div>`;
  return `<form class="pf" data-form="krec"><input type="hidden" name="tid" value="${t.id}">
    <div class="fld wide"><div class="chip">🛠 ${esc(t.name)} <small>· ${t.pts.length} itens no checklist</small> <button type="button" data-act="kunpick" class="ib" aria-label="Trocar equipamento">✕</button></div></div>
    <label class="fld">Número do equipamento *<input type="text" name="ident" required placeholder="Ex.: 02, BET-02, patrimônio…"></label>
    <label class="fld">Local / obra<input type="text" name="loc"></label>
    <label class="fld wide">Observação<textarea name="obs" rows="2" placeholder="Opcional"></textarea></label>
    <div class="bt"><button type="button" class="btn" data-act="knew">Cancelar</button><button type="submit" class="btn primary">Iniciar revisão</button></div></form>`;
}

function checkList(){
  const q = ui.kq.trim().toLowerCase();
  const rows = kRecs().filter(r => (!ui.kfT || r.tid === ui.kfT) && (!q || [r.tname, r.ident, r.loc, r.by].join(" ").toLowerCase().includes(q)));
  if (!rows.length) return `<div class="empty">${state.check.items.some(i => i.k === "rec") ? "Nenhuma revisão com esse filtro." : "Nenhuma revisão feita ainda.<br>Clique em “+ Nova revisão”."}</div>`;
  return `<div class="tw"><table class="os"><tr><th>Data</th><th>Equipamento</th><th>Resultado</th><th>Status</th><th>Feita por</th></tr>` +
    rows.map(r => { const s = recStats(r); return `<tr class="clk" data-act="kopen" data-id="${r.id}">
      <td>${kfmt(r.sd)}</td><td><b>${esc(r.tname)}</b><small>${[r.ident && "Nº " + esc(r.ident), r.loc && esc(r.loc)].filter(Boolean).join(" · ")}</small></td>
      <td><span class="pill ok">${s.ok} OK</span> ${s.nc ? `<span class="pill bad">${s.nc} problema${s.nc > 1 ? "s" : ""}</span>` : ""} ${s.pend ? `<span class="pill mute">${s.pend} pendente${s.pend > 1 ? "s" : ""}</span>` : ""}
        ${r.os ? `<span class="pill info">OS ${osNum(r.osn)}</span>` : ""}</td>
      <td><span class="pill ${r.status === "concluida" ? "ok" : "warn"}">${r.status === "concluida" ? "Concluída" : "Em andamento"}</span></td>
      <td>${MODE === "owner" && r.ub === "Davi" && r.u > ui.prevSeen ? "🆕 " : ""}${esc(byLabel(r.by))}</td></tr>`; }).join("") + `</table></div>`;
}

/* ---------- revisão em andamento ---------- */
const sameEquip = (a, b) => a.tid === b.tid && (a.ident || "").trim().toLowerCase() === (b.ident || "").trim().toLowerCase();

function recDetail(r){
  const s = recStats(r), answered = s.total - s.pend, done = r.status === "concluida";
  const title = r.tname + (r.ident ? " nº " + r.ident : "");
  let h = `<div class="nav"><button data-act="kback">← Voltar</button>
    <div class="ttl">${esc(title)} <span class="pill ${done ? "ok" : "warn"}">${done ? "Concluída" : "Em andamento"}</span></div><span style="width:44px"></span></div>`;
  h += `<div class="meta">Início ${kfmt(r.sd)}${r.ed ? " · término " + kfmt(r.ed) : ""} · ${esc(byLabel(r.by))}${r.loc ? " · " + esc(r.loc) : ""}</div>`;
  const prev = kRecs().filter(x => x.id !== r.id && sameEquip(x, r));
  if (prev.length) { const p = prev[0], ps = recStats(p); h += `<div class="meta">Última revisão deste equipamento: ${kfmt(p.sd)} — ${ps.ok} OK${ps.nc ? `, <b style="color:var(--danger)">${ps.nc} problema(s)</b>` : ""}</div>`; }
  h += `<div class="kpis">${[["Feitos (OK)", s.ok, ""], ["Problemas", s.nc, s.nc ? "warn" : ""], ["N/A", s.na, ""], ["Pendentes", s.pend, s.pend ? "warn" : ""]].map(([l, v, c]) =>
    `<div class="kpi ${c}"><small>${l}</small><b>${v}</b></div>`).join("")}</div>
    <div class="bar" style="margin:0"><i style="width:${s.total ? answered / s.total * 100 : 0}%"></i></div>`;
  if (!r.pts.length) h += `<div class="warn">Este equipamento não tem itens no checklist. Cadastre-os na aba “Equipamentos”.</div>`;
  h += `<div class="row2"><button class="btn" data-act="kallok">✔ Marcar tudo que falta como feito (OK)</button></div>`;
  h += `<ul class="cks">${r.pts.map(p => { const a = r.ans[p.id] || {}; return `<li class="${a.s === "nc" ? "nc" : ""}">
    <button class="dotc big ${a.s === "ok" ? "on" : a.s === "nc" ? "nc" : a.s === "na" ? "na" : ""}" data-act="kans" data-p="${p.id}" data-v="ok" aria-label="Marcar como feito"></button>
    <div class="t">${esc(p.text)}</div>
    <div class="seg3"><button data-act="kans" data-p="${p.id}" data-v="nc" class="${a.s === "nc" ? "on nc" : ""}">⚠ Problema</button>
      <button data-act="kans" data-p="${p.id}" data-v="na" class="${a.s === "na" ? "on na" : ""}">N/A</button></div>
    ${a.s === "nc" || a.note ? `<input type="text" class="note" data-f="kn" data-p="${p.id}" value="${esc(a.note || "")}" placeholder="O que está errado? (observação)">` : ""}</li>`; }).join("")}</ul>`;
  h += `<label class="fld">Observações gerais<textarea data-f="kobs" rows="3">${esc(r.obs)}</textarea></label>`;
  if (s.nc && r.os) h += `<div class="warn">Já existe uma OS de manutenção para esta revisão: ${osNum(r.osn)}.</div>`;
  h += `<div class="row2">${done
    ? `<button class="btn" data-act="kreopen">Reabrir revisão</button>`
    : `<button class="btn primary" data-act="kfinish">Finalizar revisão</button>`}
    ${s.nc && !r.os ? `<button class="btn" data-act="kos" style="color:var(--gold)">🔧 Abrir OS de manutenção com os problemas</button>` : ""}</div>`;
  if (prev.length) h += `<div class="sec"><h4>📜 O que já foi feito neste equipamento</h4><ul>${prev.slice(0, 15).map(x => { const xs = recStats(x); return `<li class="clk" data-act="kopen" data-id="${x.id}">
    <div class="t"><b>${kfmt(x.sd)}</b> <span class="pill ok">${xs.ok} OK</span> ${xs.nc ? `<span class="pill bad">${xs.nc} problema(s)</span>` : ""}
    <small>${esc(byLabel(x.by))}${x.loc ? " · " + esc(x.loc) : ""}${x.obs ? " · " + esc(x.obs) : ""}</small></div></li>`; }).join("")}</ul></div>`;
  return h + `<button class="danger" data-act="kdel">Excluir esta revisão</button>`;
}

/* ---------- modelo de checklist ---------- */
function typeDetail(t){
  let h = `<div class="nav"><button data-act="kback">← Voltar</button><div class="ttl">Equipamento e checklist</div><span style="width:44px"></span></div>`;
  h += `<label class="fld">Nome do equipamento<input type="text" data-f="ktn" value="${esc(t.name)}"></label>
    <div class="sub">Itens do checklist (${t.pts.length})</div>
    <ul class="cks">${t.pts.map((p, n) => `<li><div class="t"><input type="text" data-f="ktp" data-p="${p.id}" value="${esc(p.text)}"></div>
      <div class="seg3"><button data-act="kup" data-p="${p.id}" ${n === 0 ? "disabled" : ""} aria-label="Subir">▲</button>
      <button data-act="kdown" data-p="${p.id}" ${n === t.pts.length - 1 ? "disabled" : ""} aria-label="Descer">▼</button>
      <button data-act="kptdel" data-p="${p.id}" aria-label="Remover">✕</button></div></li>`).join("") || `<div class="empty">Nenhum ponto ainda.</div>`}</ul>
    <form class="pf" data-form="kpt"><label class="fld wide">Adicionar itens (um por linha)<textarea name="pts" rows="4" placeholder="Ex.:&#10;Freio de segurança&#10;Aterramento elétrico"></textarea></label>
      <div class="bt"><button type="submit" class="btn primary">+ Adicionar ao checklist</button></div></form>
    <div class="meta">Mudanças no checklist valem para as próximas revisões. As revisões já feitas mantêm os itens que tinham.</div>
    <button class="danger" data-act="ktdel">Excluir este equipamento</button>`;
  return h;
}

/* ---------- ações ---------- */
const linesOf = txt => String(txt || "").split("\n").map(x => x.trim()).filter(Boolean);
const curRec = () => state.check.items.find(x => x.id === ui.kOpen);
const curType = () => state.check.items.find(x => x.id === ui.kType);

function checkClick(a, D, c){
  if (a === "ktab") { ui.kt = D.t; ui.kNew = false; ui.kNewType = false; ui.kPick = null; ui.ks = ""; renderPanel(); return true; }
  if (a === "kpick") { ui.kPick = D.id; renderPanel(); const i = panel.querySelector('[name=ident]'); if (i) i.focus(); return true; }
  if (a === "kunpick") { ui.kPick = null; renderPanel(); return true; }
  if (a === "knew") { ui.kNew = !ui.kNew; ui.kPick = null; ui.ks = ""; renderPanel(); return true; }
  if (a === "knewtype") { ui.kNewType = !ui.kNewType; renderPanel(); return true; }
  if (a === "kopen") { ui.kOpen = D.id; renderPanel(); panel.scrollTop = 0; return true; }
  if (a === "ktopen") { ui.kType = D.id; renderPanel(); panel.scrollTop = 0; return true; }
  if (a === "kback") { ui.kOpen = null; ui.kType = null; renderPanel(); return true; }
  const r = ui.kOpen && curRec(), t = ui.kType && curType();
  if (r) {
    if (a === "kans") {
      const cur = r.ans[D.p] || {};
      if (cur.s === D.v) delete r.ans[D.p]; else r.ans[D.p] = { s:D.v, note:cur.note || "" };
      stamp(r); refresh(); return true;
    }
    if (a === "kallok") { r.pts.forEach(p => { if (!r.ans[p.id]) r.ans[p.id] = { s:"ok", note:"" }; }); stamp(r); refresh(); return true; }
    if (a === "kfinish") {
      const s = recStats(r);
      if (s.pend && !confirm(`Ainda há ${s.pend} ponto(s) sem resposta. Finalizar mesmo assim?`)) return true;
      r.status = "concluida"; r.ed = new Date().toISOString(); stamp(r); refresh(); return true;
    }
    if (a === "kreopen") { r.status = "andamento"; r.ed = ""; stamp(r); refresh(); return true; }
    if (a === "kdel") {
      if (!confirm("Excluir esta revisão?")) return true;
      c.items = c.items.filter(x => x !== r); c.del[r.id] = Date.now(); ui.kOpen = null; refresh(); return true;
    }
    if (a === "kos") {
      const m = state.maint, nc = r.pts.filter(p => r.ans[p.id] && r.ans[p.id].s === "nc"), [nd, nt] = nowParts();
      const n = Math.max(0, ...m.items.map(x => x.n)) + 1;
      const it = normMaintItem({ id:uid(), n, equip:r.tname + (r.ident ? " " + r.ident : ""), serial:r.ident, loc:r.loc, mtype:"Corretiva",
        pri:nc.length > 2 ? "alta" : "media", resp:respList()[0], sd:nd, st:nt, status:"aberta", by:ME(), c:Date.now(),
        problem:"Pontos reprovados na revisão:\n" + nc.map(p => `• ${p.text}${r.ans[p.id].note ? " — " + r.ans[p.id].note : ""}`).join("\n") });
      mlog(it, "OS gerada a partir de uma revisão"); stamp(it); m.items.push(it);
      r.os = it.id; r.osn = n; stamp(r); refresh(); return true;
    }
  }
  if (t) {
    const mv = d => { const i = t.pts.findIndex(x => x.id === D.p), j = i + d; if (j < 0 || j >= t.pts.length) return;
      [t.pts[i], t.pts[j]] = [t.pts[j], t.pts[i]]; stamp(t); refresh(); };
    if (a === "kup") { mv(-1); return true; }
    if (a === "kdown") { mv(1); return true; }
    if (a === "kptdel") { t.pts = t.pts.filter(x => x.id !== D.p); stamp(t); refresh(); return true; }
    if (a === "ktdel") {
      if (!confirm(`Excluir o equipamento "${t.name}" e o checklist dele? As revisões já feitas continuam no histórico.`)) return true;
      c.items = c.items.filter(x => x !== t); c.del[t.id] = Date.now(); ui.kType = null; refresh(); return true;
    }
  }
  return false;
}

function checkChange(e, f, c){
  const t = e.target;
  if (f === "kf") { ui.kfT = t.value; renderPanel(); return; }
  const r = ui.kOpen && curRec(), ty = ui.kType && curType();
  if (r && f === "kn") { (r.ans[t.dataset.p] = r.ans[t.dataset.p] || { s:"nc" }).note = t.value; stamp(r); save(); return; }
  if (r && f === "kobs") { r.obs = t.value; stamp(r); save(); return; }
  if (ty && f === "ktn") { ty.name = t.value.trim() || ty.name; stamp(ty); save(); render(); return; }
  if (ty && f === "ktp") { const p = ty.pts.find(x => x.id === t.dataset.p); if (p) { p.text = t.value.trim() || p.text; stamp(ty); save(); } }
}

function checkSubmit(form, fd, c){
  const kind = form.dataset.form, g = k => (fd.get(k) || "").trim();
  if (kind === "ktype") {
    const name = g("text"); if (!name) return;
    const t = { id:uid(), k:"type", name, pts:linesOf(fd.get("pts")).map(text => ({ id:uid(), text })), c:Date.now(), u:0, ub:"" };
    stamp(t); c.items.push(t); ui.kNewType = false; ui.kType = t.id; refresh(); panel.scrollTop = 0; return;
  }
  if (kind === "krec") {
    const t = c.items.find(x => x.id === fd.get("tid")); if (!t) return;
    const r = normCheck({ items:[{ id:uid(), k:"rec", tid:t.id, tname:t.name, ident:g("ident"), loc:g("loc"), obs:g("obs"),
      pts:t.pts.map(p => ({ id:p.id, text:p.text })), by:ME(), c:Date.now() }] }).items[0];
    stamp(r); c.items.push(r); ui.kNew = false; ui.kPick = null; ui.ks = ""; ui.kOpen = r.id; refresh(); panel.scrollTop = 0; return;
  }
  if (kind === "kpt" && ui.kType) {
    const t = curType(); if (!t) return;
    const add = linesOf(fd.get("pts")); if (!add.length) return;
    add.forEach(text => t.pts.push({ id:uid(), text })); stamp(t); refresh();
  }
}
