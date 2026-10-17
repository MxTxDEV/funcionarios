/* ---------- manutenções: ordem de serviço (OS) completa ---------- */
const MST = {
  aberta:["Aberta", "warn"], andamento:["Em andamento", "info"], aguardando:["Aguardando peça", "bad"],
  concluida:["Concluída", "ok"], cancelada:["Cancelada", "mute"]
};
const MTYPES = ["Corretiva", "Preventiva", "Preditiva", "Instalação", "Inspeção", "Calibração", "Outro"];
const PRI_L = { alta:"Alta", media:"Média", baixa:"Baixa" };
const respList = cur => {
  const l = MODE === "davi" ? ["Davi", "Dono"] : ["Eu", ...state.people.map(p => p.name)];
  if (cur && !l.includes(cur)) l.push(cur);
  return l;
};
const isOpenOS = i => i.status !== "concluida" && i.status !== "cancelada";
const osNum = n => "#" + String(n).padStart(4, "0");
const nowParts = () => { const d = new Date(); return [iso(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`]; };
const partsCost = i => i.parts.reduce((a, p) => a + p.qty * p.cost, 0);
const laborCost = i => i.hrs * i.rate;
const totalCost = i => partsCost(i) + laborCost(i) + i.extra;
const mlog = (i, text) => i.log.unshift({ d:new Date().toISOString(), by:ME(), text });

function normMaintItem(i){
  return { id:i.id || uid(), n:+i.n || 0, equip:i.equip || "Equipamento", brand:i.brand || "", serial:i.serial || "", loc:i.loc || "",
    client:i.client || "", mtype:i.mtype || "Corretiva", pri:i.pri || "media", resp:i.resp || "Eu", status:MST[i.status] ? i.status : "aberta",
    sd:i.sd || i.opened || todayIso(), st:i.st || "", ed:i.ed || i.closed || "", et:i.et || "", due:i.due || "",
    problem:i.problem || "", cause:i.cause || "", todo:i.todo || "", done:i.done || "", obs:i.obs || "",
    tasks:Array.isArray(i.tasks) ? i.tasks : [], parts:Array.isArray(i.parts) ? i.parts : [], log:Array.isArray(i.log) ? i.log : [],
    hrs:+i.hrs || 0, rate:+i.rate || 0, extra:+i.extra || 0, warranty:+i.warranty || 0,
    by:i.by || "Eu", c:+i.c || 0, u:+i.u || 0, ub:i.ub || "" };
}
function numberMaint(items){
  let max = Math.max(0, ...items.map(i => i.n));
  items.filter(i => !i.n).sort((a, b) => (a.c || 0) - (b.c || 0) || a.sd.localeCompare(b.sd)).forEach(i => { i.n = ++max; });
}

const dtOf = (d, t) => d ? new Date(`${d}T${t || "00:00"}`) : null;
function elapsedMin(i){
  const a = dtOf(i.sd, i.st); if (!a) return 0;
  const b = i.ed ? dtOf(i.ed, i.et || "23:59") : new Date();
  return Math.max(0, Math.round((b - a) / 60000));
}
function elapsedText(i){
  if (!i.sd) return "—";
  const m = elapsedMin(i), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mi = m % 60;
  const t = [d && d + "d", h && h + "h", (mi || (!d && !h)) && mi + "min"].filter(Boolean).join(" ");
  return t + (i.ed ? "" : " (em andamento)");
}
const fmtStart = i => i.sd ? fmtD(i.sd) + (i.st ? " " + i.st : "") : "—";
const lateOS = i => isOpenOS(i) && i.due && i.due < todayIso();

function setStatus(i, v){
  if (i.status === v) return;
  const old = MST[i.status][0], [nd, nt] = nowParts();
  i.status = v;
  if (v === "andamento" && !i.st) { i.sd = i.sd || nd; i.st = nt; }
  if (v === "concluida" || v === "cancelada") { if (!i.ed) { i.ed = nd; i.et = nt; } } else { i.ed = ""; i.et = ""; }
  mlog(i, `Status: ${old} → ${MST[v][0]}`);
  stamp(i);
}

/* ---------- tela principal ---------- */
function maintHtml(m){
  if (ui.mOpen) { const i = m.items.find(x => x.id === ui.mOpen); if (i) return maintDetail(i); ui.mOpen = null; }
  const c = k => m.items.filter(i => i.status === k).length;
  const mk = monthKey(new Date());
  const doneM = m.items.filter(i => i.status === "concluida" && (i.ed || "").startsWith(mk));
  const late = m.items.filter(lateOS).length;
  const kp = (l, v, cl = "") => `<div class="kpi ${cl}"><small>${l}</small><b>${v}</b></div>`;
  let h = `<div class="kpis">${kp("Abertas", c("aberta"))}${kp("Em andamento", c("andamento"))}${kp("Aguardando peça", c("aguardando"), c("aguardando") ? "warn" : "")}
    ${kp("Atrasadas", late, late ? "warn" : "")}${kp("Concluídas no mês", doneM.length)}${kp("Custo no mês", brl(doneM.reduce((a, i) => a + totalCost(i), 0)))}</div>`;
  h += `<div class="addform"><input type="text" data-f="mq" placeholder="Buscar OS, equipamento, cliente, série…" value="${esc(ui.mq)}" autocomplete="off">
    <select data-f="mtf" aria-label="Tipo"><option value="">Todos os tipos</option>${MTYPES.map(t => `<option ${t === ui.mt ? "selected" : ""}>${t}</option>`).join("")}</select>
    <button class="btn primary" data-act="mnew">${ui.mNew ? "Fechar" : "+ Nova OS"}</button></div>`;
  if (ui.mNew) h += newOSForm();
  h += `<div class="seg wrap">${[["todas", "Todas"], ["aberta", "Abertas"], ["andamento", "Em andamento"], ["aguardando", "Aguardando peça"], ["concluida", "Concluídas"]].map(([k, l]) =>
    `<button data-act="mf" data-v="${k}" class="${ui.mf === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
  return h + `<div id="mlist">${maintList()}</div>`;
}

function newOSForm(){
  const [nd, nt] = nowParts();
  const sel = (name, opts, cur) => `<select name="${name}">${opts.map(o => `<option value="${esc(o[0])}" ${o[0] === cur ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
  return `<form class="pf" data-form="maint">
    <label class="fld wide">Equipamento *<input type="text" name="text" placeholder="Ex.: Ar-condicionado 12.000 BTUs, Furadeira de bancada…" required></label>
    <label class="fld">Marca / modelo<input type="text" name="brand"></label>
    <label class="fld">Nº de série / patrimônio<input type="text" name="serial"></label>
    <label class="fld">Cliente / solicitante<input type="text" name="client"></label>
    <label class="fld">Local / setor<input type="text" name="loc"></label>
    <label class="fld">Tipo de manutenção${sel("mtype", MTYPES.map(t => [t, t]), "Corretiva")}</label>
    <label class="fld">Prioridade${sel("pri", [["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]], "media")}</label>
    <label class="fld">Técnico responsável${sel("resp", respList().map(r => [r, byLabel(r)]), respList()[0])}</label>
    <label class="fld">Data de início<input type="date" name="sd" value="${nd}"></label>
    <label class="fld">Hora de início<input type="time" name="st" value="${nt}"></label>
    <label class="fld">Previsão de conclusão<input type="date" name="due"></label>
    <label class="fld wide">Problema relatado (o que é)<textarea name="problem" rows="2"></textarea></label>
    <label class="fld wide">O que precisa ser feito<textarea name="todo" rows="2"></textarea></label>
    <div class="bt"><button type="button" class="btn" data-act="mnew">Cancelar</button><button type="submit" class="btn primary">Abrir OS</button></div></form>`;
}

function maintList(){
  const m = state.maint, q = ui.mq.trim().toLowerCase(), today = todayIso();
  const order = { alta:0, media:1, baixa:2 };
  const rows = m.items.filter(i => (ui.mf === "todas" || i.status === ui.mf) && (!ui.mt || i.mtype === ui.mt) &&
      (!q || [osNum(i.n), i.n, i.equip, i.brand, i.serial, i.client, i.loc, i.resp, i.problem].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => (!isOpenOS(a)) - (!isOpenOS(b)) || (isOpenOS(a) ? (order[a.pri] - order[b.pri] || a.sd.localeCompare(b.sd)) : (b.ed || "").localeCompare(a.ed || "")));
  if (!rows.length) return `<div class="empty">${m.items.length ? "Nenhuma OS com esse filtro." : "Nenhuma manutenção registrada.<br>Clique em “+ Nova OS” para abrir a primeira."}</div>`;
  return `<div class="tw"><table class="os"><tr><th>OS</th><th>Equipamento</th><th>Tipo</th><th>Status</th><th>Técnico</th><th>Início</th><th>Previsão</th><th class="r">Custo</th></tr>` +
    rows.map(i => `<tr class="clk" data-act="mopen" data-id="${i.id}">
      <td><span class="pri ${i.pri}" title="Prioridade ${PRI_L[i.pri]}"></span> <b>${osNum(i.n)}</b></td>
      <td><b>${esc(i.equip)}</b>${MODE === "owner" && i.ub === "Davi" && i.u > ui.prevSeen ? ` <span class="pill info">🆕</span>` : ""}
        <small>${[i.brand, i.serial && "Nº " + i.serial, i.client].filter(Boolean).map(esc).join(" · ")}</small></td>
      <td>${esc(i.mtype)}</td>
      <td><span class="pill ${MST[i.status][1]}">${MST[i.status][0]}</span></td>
      <td>${esc(byLabel(i.resp))}</td><td>${fmtStart(i)}</td>
      <td style="${lateOS(i) ? "color:var(--danger);font-weight:700" : ""}">${i.due ? fmtD(i.due) + (lateOS(i) ? " ⚠" : "") : "—"}</td>
      <td class="r">${totalCost(i) ? brl(totalCost(i)) : "—"}</td></tr>`).join("") + `</table></div>`;
}

/* ---------- detalhe da OS ---------- */
function maintDetail(i){
  const f = (label, k, type = "text", extra = "", cls = "") =>
    `<label class="fld ${cls}">${label}<input type="${type}" data-f="mf" data-k="${k}" data-id="${i.id}" value="${esc(i[k])}" ${extra}></label>`;
  const ta = (label, k, rows = 3, cls = "wide") =>
    `<label class="fld ${cls}">${label}<textarea data-f="mf" data-k="${k}" data-id="${i.id}" rows="${rows}">${esc(i[k])}</textarea></label>`;
  const sel = (label, k, opts) =>
    `<label class="fld">${label}<select data-f="mf" data-k="${k}" data-id="${i.id}">${opts.map(o => `<option value="${esc(o[0])}" ${o[0] === i[k] ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
  const tdone = i.tasks.filter(t => t.done).length;

  let h = `<div class="nav"><button data-act="mback">← Voltar</button>
    <div class="ttl">OS ${osNum(i.n)} <span class="pill ${MST[i.status][1]}">${MST[i.status][0]}</span></div>
    <button data-act="mprint">🖨 Imprimir</button></div>`;
  h += `<div class="seg wrap">${Object.keys(MST).map(k => `<button data-act="mstatus" data-v="${k}" class="${i.status === k ? "on" : ""}">${MST[k][0]}</button>`).join("")}</div>`;

  h += `<div class="sec"><h4>🛠 Equipamento</h4><div class="g">
    ${f("Equipamento", "equip", "text", "", "wide")}${f("Marca / modelo", "brand")}${f("Nº de série / patrimônio", "serial")}
    ${f("Cliente / solicitante", "client")}${f("Local / setor", "loc")}</div></div>`;

  h += `<div class="sec"><h4>📋 Serviço</h4><div class="g">
    ${sel("Tipo de manutenção", "mtype", MTYPES.map(t => [t, t]))}
    ${sel("Prioridade", "pri", [["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]])}
    ${sel("Técnico responsável", "resp", respList(i.resp).map(r => [r, byLabel(r)]))}
    ${f("Garantia do serviço (dias)", "warranty", "number", 'min="0"')}</div></div>`;

  h += `<div class="sec"><h4>🕒 Datas e horários</h4><div class="g">
    ${f("Data de início", "sd", "date")}${f("Hora de início", "st", "time")}
    ${f("Data de término", "ed", "date")}${f("Hora de término", "et", "time")}
    ${f("Previsão de conclusão", "due", "date")}
    <div class="fld">Tempo decorrido<div class="ro" id="mel">${elapsedText(i)}</div></div></div></div>`;

  h += `<div class="sec"><h4>🔎 Diagnóstico e serviço</h4><div class="g">
    ${ta("Problema relatado (o que é)", "problem", 3)}${ta("Causa / diagnóstico", "cause", 3)}${ta("O que precisa ser feito", "todo", 3)}</div>
    <div class="sub" style="margin-top:12px">Checklist ${i.tasks.length ? `(${tdone}/${i.tasks.length})` : ""}</div>
    <ul class="cl">${i.tasks.map(t => `<li class="${t.done ? "done" : ""}"><button class="dotc ${t.done ? "on" : ""}" data-act="ttask" data-t="${t.id}" aria-label="Marcar"></button>
      <div class="t">${esc(t.text)}</div><button class="del" data-act="dtask" data-t="${t.id}" aria-label="Remover">✕</button></li>`).join("")}</ul>
    <form class="addform" data-form="mtask"><input type="text" name="text" placeholder="Adicionar etapa ao checklist…" autocomplete="off"><button class="go" type="submit" aria-label="Adicionar">+</button></form>
    <div class="g" style="margin-top:12px">${ta("O que foi feito", "done", 3)}${ta("Observações", "obs", 2)}</div></div>`;

  const stk = state.stock.items.filter(p => p.qty > 0).sort((a, b) => a.name.localeCompare(b.name));
  h += `<div class="sec"><h4>🔩 Peças utilizadas</h4>
    ${i.parts.length ? `<div class="tw"><table><tr><th>Peça</th><th class="r">Qtd</th><th class="r">Custo unit.</th><th class="r">Subtotal</th><th></th></tr>` +
      i.parts.map(p => `<tr><td>${esc(p.name)}${p.pid ? ` <span class="pill ok" title="Baixa automática no estoque">estoque</span>` : ""}</td>
        <td class="r">${p.pid ? fmtQ(p.qty) : `<input class="mini-in" type="number" step="any" min="0" data-f="pt" data-k="qty" data-id="${i.id}" data-pid="${p.id}" value="${p.qty}">`}</td>
        <td class="r"><input class="mini-in" type="number" step="0.01" min="0" data-f="pt" data-k="cost" data-id="${i.id}" data-pid="${p.id}" value="${p.cost}"></td>
        <td class="r" data-psub="${p.id}">${brl(p.qty * p.cost)}</td>
        <td class="act"><button class="ib" data-act="ptdel" data-p="${p.id}" aria-label="Remover peça">✕</button></td></tr>`).join("") + `</table></div>`
      : `<div class="empty" style="padding:10px 0">Nenhuma peça lançada.</div>`}
    <form class="pf" data-form="mpart" style="margin-top:10px">
      <label class="fld wide">Peça do estoque (dá baixa automática)<select name="pid"><option value="">— peça avulsa (digitar abaixo) —</option>
        ${stk.map(p => `<option value="${p.id}">${esc(p.name)} (${fmtQ(p.qty)} ${esc(p.unit)})</option>`).join("")}</select></label>
      <label class="fld wide">Ou descreva a peça avulsa<input type="text" name="text" placeholder="Ex.: Capacitor 35µF"></label>
      <label class="fld">Quantidade<input type="number" name="qty" step="any" min="0" value="1"></label>
      <label class="fld">Custo unitário (R$)<input type="number" name="cost" step="0.01" min="0" placeholder="usa o do estoque"></label>
      <div class="bt"><button type="submit" class="btn primary">+ Adicionar peça</button></div></form></div>`;

  h += `<div class="sec"><h4>💰 Mão de obra e custos</h4><div class="g">
    ${f("Horas trabalhadas", "hrs", "number", 'min="0" step="0.25"')}${f("Valor da hora (R$)", "rate", "number", 'min="0" step="0.01"')}
    ${f("Outros custos (deslocamento, terceiros)", "extra", "number", 'min="0" step="0.01"')}</div>
    <div class="row2" style="margin-top:8px"><button class="btn" data-act="usehrs">Usar o tempo decorrido (${(elapsedMin(i) / 60).toFixed(2).replace(".", ",")} h)</button></div>
    <div class="tot" id="mtot">${totalsHtml(i)}</div></div>`;

  h += `<div class="sec"><h4>📜 Histórico</h4><ul class="tl">${i.log.map(l =>
    `<li><b>${fmtDT(l.d)}</b> · ${esc(byLabel(l.by))}<br>${esc(l.text)}</li>`).join("") || `<li>Sem registros.</li>`}</ul>
    <div class="meta">OS aberta por ${esc(byLabel(i.by))}</div></div>`;
  h += `<button class="danger" data-act="mdel">Excluir esta OS</button>`;
  return h;
}

const totalsHtml = i => `<div><small>Peças</small><b>${brl(partsCost(i))}</b></div><div><small>Mão de obra</small><b>${brl(laborCost(i))}</b></div>
  <div><small>Outros</small><b>${brl(i.extra)}</b></div><div class="all"><small>Total da OS</small><b>${brl(totalCost(i))}</b></div>`;

function updateTotals(i){
  const t = $("#mtot"); if (t) t.innerHTML = totalsHtml(i);
  const e = $("#mel"); if (e) e.textContent = elapsedText(i);
  i.parts.forEach(p => { const c = panel.querySelector(`[data-psub="${p.id}"]`); if (c) c.textContent = brl(p.qty * p.cost); });
}

/* ---------- ações ---------- */
function maintClick(a, D, m){
  const cur = () => m.items.find(x => x.id === ui.mOpen);
  if (a === "mf") { ui.mf = D.v; renderPanel(); return true; }
  if (a === "mnew") { ui.mNew = !ui.mNew; renderPanel(); return true; }
  if (a === "mopen") { ui.mOpen = D.id; renderPanel(); panel.scrollTop = 0; return true; }
  if (a === "mback") { ui.mOpen = null; renderPanel(); return true; }
  if (!ui.mOpen) return false;
  const i = cur(); if (!i) return false;
  if (a === "mstatus") { setStatus(i, D.v); refresh(); return true; }
  if (a === "ttask") { const t = i.tasks.find(x => x.id === D.t); t.done = !t.done; mlog(i, `${t.done ? "✔ Etapa concluída" : "Etapa reaberta"}: ${t.text}`); stamp(i); refresh(); return true; }
  if (a === "dtask") { i.tasks = i.tasks.filter(x => x.id !== D.t); stamp(i); refresh(); return true; }
  if (a === "ptdel") {
    const p = i.parts.find(x => x.id === D.p), pr = p.pid && state.stock.items.find(x => x.id === p.pid);
    if (pr && confirm(`Devolver ${fmtQ(p.qty)} ${pr.unit} de "${p.name}" ao estoque?\n\nOK = devolve ao estoque\nCancelar = só remove da OS (a peça foi consumida)`)) {
      pr.qty += p.qty; stamp(pr); stockMove(state.stock, pr, "in", p.qty, `Devolução da OS ${osNum(i.n)}`);
    }
    i.parts = i.parts.filter(x => x !== p); mlog(i, `Peça removida: ${p.name}`); stamp(i); refresh(); return true;
  }
  if (a === "usehrs") { i.hrs = Math.round(elapsedMin(i) / 60 * 100) / 100; stamp(i); refresh(); return true; }
  if (a === "mprint") { printOS(i); return true; }
  if (a === "mdel") {
    if (!confirm(`Excluir a OS ${osNum(i.n)} (${i.equip})? Isso não pode ser desfeito.`)) return true;
    m.items = m.items.filter(x => x !== i); m.del[i.id] = Date.now(); ui.mOpen = null; refresh(); return true;
  }
  return false;
}

function maintChange(e, f, m){
  const t = e.target;
  if (f === "mtf") { ui.mt = t.value; renderPanel(); return; }
  const i = m.items.find(x => x.id === t.dataset.id); if (!i) return;
  if (f === "mf") {
    const k = t.dataset.k;
    i[k] = t.type === "number" ? Math.max(0, num(t.value)) : t.value;
    stamp(i); save(); render(); updateTotals(i);
    if (k === "pri" || k === "resp") renderPanel();
  } else if (f === "pt") {
    const p = i.parts.find(x => x.id === t.dataset.pid); if (!p) return;
    p[t.dataset.k] = Math.max(0, num(t.value));
    stamp(i); save(); updateTotals(i);
  }
}

function maintSubmit(form, fd, m){
  const kind = form.dataset.form;
  if (kind === "maint") {
    const equip = (fd.get("text") || "").trim(); if (!equip) return;
    const g = k => (fd.get(k) || "").trim();
    const n = Math.max(0, ...m.items.map(x => x.n)) + 1;
    const it = normMaintItem({ id:uid(), n, equip, brand:g("brand"), serial:g("serial"), client:g("client"), loc:g("loc"), mtype:g("mtype"),
      pri:g("pri"), resp:g("resp") || respList()[0], sd:g("sd"), st:g("st"), due:g("due"), problem:g("problem"), todo:g("todo"),
      status:"aberta", by:ME(), c:Date.now() });
    mlog(it, "OS aberta"); stamp(it);
    m.items.push(it); ui.mNew = false; ui.mOpen = it.id;
    refresh(); panel.scrollTop = 0; return;
  }
  const i = m.items.find(x => x.id === ui.mOpen); if (!i) return;
  if (kind === "mtask") {
    const text = (fd.get("text") || "").trim(); if (!text) return;
    i.tasks.push({ id:uid(), text, done:false }); stamp(i); refresh();
    const t = panel.querySelector('[data-form="mtask"] input'); if (t) t.focus(); return;
  }
  if (kind === "mpart") {
    const pid = fd.get("pid"), q = num(fd.get("qty")) || 1;
    let name = (fd.get("text") || "").trim(), cost = num(fd.get("cost")), unit = "";
    if (pid) {
      const pr = state.stock.items.find(x => x.id === pid); if (!pr) return;
      if (q > pr.qty) { alert(`Saldo insuficiente: só há ${fmtQ(pr.qty)} ${pr.unit} em estoque.`); return; }
      name = pr.name; unit = pr.unit; if (!fd.get("cost")) cost = pr.cost;
      pr.qty -= q; stamp(pr); stockMove(state.stock, pr, "out", -q, `Usada na OS ${osNum(i.n)}`);
    } else if (!name) return;
    i.parts.push({ id:uid(), name, qty:q, cost, pid:pid || "", unit });
    mlog(i, `Peça usada: ${fmtQ(q)}× ${name}`); stamp(i); refresh();
  }
}

/* ---------- impressão da OS ---------- */
function printOS(i){
  const r = (l, v) => `<tr><th>${l}</th><td>${esc(v || "—")}</td></tr>`;
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>OS ${osNum(i.n)}</title>
    <style>body{font:14px/1.45 system-ui,sans-serif;color:#111;margin:28px}h1{margin:0 0 4px}h2{font-size:15px;margin:20px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
    table{width:100%;border-collapse:collapse}th{text-align:left;width:34%;color:#444;font-weight:600;padding:4px 8px 4px 0;vertical-align:top}td{padding:4px 0}
    .g td,.g th{border:1px solid #bbb;padding:5px 8px;width:auto}.r{text-align:right}.box{border:1px solid #bbb;padding:8px;min-height:40px;white-space:pre-wrap}
    .sig{display:flex;gap:40px;margin-top:50px}.sig div{flex:1;border-top:1px solid #111;padding-top:4px;text-align:center}</style>
    <h1>Ordem de Serviço ${osNum(i.n)}</h1><div>${esc(MST[i.status][0])} · Prioridade ${PRI_L[i.pri]} · ${esc(i.mtype)}</div>
    <h2>Equipamento</h2><table>${r("Equipamento", i.equip)}${r("Marca / modelo", i.brand)}${r("Nº de série / patrimônio", i.serial)}${r("Cliente / solicitante", i.client)}${r("Local / setor", i.loc)}</table>
    <h2>Execução</h2><table>${r("Técnico responsável", byLabel(i.resp))}${r("Início", fmtStart(i))}${r("Término", i.ed ? fmtD(i.ed) + (i.et ? " " + i.et : "") : "")}${r("Previsão", i.due ? fmtD(i.due) : "")}${r("Tempo decorrido", elapsedText(i))}${r("Garantia", i.warranty ? i.warranty + " dias" : "")}</table>
    <h2>Problema relatado</h2><div class="box">${esc(i.problem)}</div>
    <h2>Causa / diagnóstico</h2><div class="box">${esc(i.cause)}</div>
    <h2>O que precisa ser feito</h2><div class="box">${esc(i.todo)}${i.tasks.length ? "\n" + i.tasks.map(t => (t.done ? "☑ " : "☐ ") + esc(t.text)).join("\n") : ""}</div>
    <h2>O que foi feito</h2><div class="box">${esc(i.done)}</div>
    <h2>Peças utilizadas</h2>${i.parts.length ? `<table class="g"><tr><th>Peça</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Subtotal</th></tr>${i.parts.map(p =>
      `<tr><td>${esc(p.name)}</td><td class="r">${fmtQ(p.qty)}</td><td class="r">${brl(p.cost)}</td><td class="r">${brl(p.qty * p.cost)}</td></tr>`).join("")}</table>` : "<div>Nenhuma peça.</div>"}
    <h2>Custos</h2><table class="g"><tr><th>Peças</th><td class="r">${brl(partsCost(i))}</td></tr><tr><th>Mão de obra (${fmtQ(i.hrs)} h × ${brl(i.rate)})</th><td class="r">${brl(laborCost(i))}</td></tr>
    <tr><th>Outros</th><td class="r">${brl(i.extra)}</td></tr><tr><th>TOTAL</th><td class="r"><b>${brl(totalCost(i))}</b></td></tr></table>
    ${i.obs ? `<h2>Observações</h2><div class="box">${esc(i.obs)}</div>` : ""}
    <div class="sig"><div>Técnico</div><div>Cliente / responsável</div></div></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("O navegador bloqueou a janela de impressão. Permita pop-ups para este site."); return; }
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
