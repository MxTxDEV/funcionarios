/* ---------- vendedor externo: prospecção e clientes ---------- */
const STAGES = [
  ["novo", "Novo", "info"], ["contatado", "Contatado", "info"], ["visita", "Visita / reunião", "warn"],
  ["proposta", "Proposta enviada", "warn"], ["negociacao", "Negociação", "warn"], ["ganho", "Fechado ✔", "ok"], ["perdido", "Perdido", "bad"]
];
const CTYPES = ["Empresa", "Obra / construtora", "Pessoa física", "Parceria / revenda", "Órgão público", "Condomínio", "Indústria", "Comércio", "Outro"];
const SERVICES = ["Manutenção", "Instalação", "Venda de equipamento", "Contrato recorrente", "Locação", "Peças e acessórios", "Orçamento / consultoria", "Outro"];
const ORIGINS = ["Indicação", "Visita porta a porta", "Instagram / redes sociais", "Google", "WhatsApp", "Telefone", "Evento / feira", "Parceiro", "Outro"];
const INTERACTIONS = [["lig", "📞 Ligação"], ["wa", "💬 WhatsApp"], ["vis", "🚗 Visita"], ["reu", "🤝 Reunião"], ["mail", "✉ E-mail"], ["obs", "📝 Anotação"]];
const stageOf = k => STAGES.find(s => s[0] === k) || STAGES[0];
const isActive = l => l.stage !== "ganho" && l.stage !== "perdido";
const intLabel = k => (INTERACTIONS.find(x => x[0] === k) || [0, k === "etapa" ? "🔀 Etapa" : k])[1];
const digits = s => String(s || "").replace(/\D/g, "");
const waLink = s => { const d = digits(s); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : ""; };

function normCrm(c){
  c = Object.assign({ name:"Vendedor Externo", role:"Prospecção e clientes", leads:[] }, c);
  c.leads = (c.leads || []).map(l => ({ id:l.id || uid(), name:l.name || "Cliente", contact:l.contact || "", phone:l.phone || "", email:l.email || "",
    city:l.city || "", address:l.address || "", ctype:l.ctype || CTYPES[0], service:l.service || SERVICES[0], equip:l.equip || "",
    origin:l.origin || ORIGINS[0], stage:stageOf(l.stage)[0] === l.stage ? l.stage : "novo", value:+l.value || 0, pri:l.pri || "media",
    next:l.next || "", lost:l.lost || "", wd:l.wd || "", notes:l.notes || "", c:+l.c || Date.now(), log:Array.isArray(l.log) ? l.log : [] }));
  return c;
}

function salesStats(c){
  const today = todayIso(), mk = monthKey(new Date());
  const act = c.leads.filter(isActive), won = c.leads.filter(l => l.stage === "ganho"), lost = c.leads.filter(l => l.stage === "perdido");
  const wonM = won.filter(l => l.wd.startsWith(mk));
  return { n:c.leads.length, active:act.length, pipe:act.reduce((a, l) => a + l.value, 0),
    wonM:wonM.length, wonMv:wonM.reduce((a, l) => a + l.value, 0),
    conv:won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : 0,
    due:act.filter(l => l.next && l.next <= today).length, late:act.filter(l => l.next && l.next < today).length };
}

const llog = (l, type, text) => l.log.unshift({ d:new Date().toISOString(), type, text });
function setStage(l, k){
  if (l.stage === k) return true;
  let reason = "";
  if (k === "perdido") { reason = prompt("Motivo da perda (opcional):", l.lost || ""); if (reason === null) return false; }
  llog(l, "etapa", `${stageOf(l.stage)[1]} → ${stageOf(k)[1]}${reason ? " (" + reason + ")" : ""}`);
  l.stage = k; l.lost = k === "perdido" ? reason : ""; l.wd = k === "ganho" ? todayIso() : "";
  if (k === "ganho" || k === "perdido") l.next = "";
  return true;
}

/* ---------- tela principal ---------- */
function salesHtml(c){
  if (ui.cOpen) { const l = c.leads.find(x => x.id === ui.cOpen); if (l) return salesDetail(l); ui.cOpen = null; }
  const k = salesStats(c);
  const kp = (l, v, cl = "") => `<div class="kpi ${cl}"><small>${l}</small><b>${v}</b></div>`;
  let h = `<div class="kpis">${kp("Clientes no funil", k.active)}${kp("Valor em negociação", brl(k.pipe))}
    ${kp("Fechados no mês", `${k.wonM} · ${brl(k.wonMv)}`)}${kp("Conversão", k.conv + "%")}
    ${kp("Follow-ups hoje / atrasados", `${k.due} · ${k.late} atrasado${k.late === 1 ? "" : "s"}`, k.due ? "warn" : "")}</div>`;
  h += `<div class="tabs">${[["lista", "Clientes"], ["funil", "Funil de vendas"], ["agenda", "Agenda de contatos"]].map(([t, l]) =>
    `<button data-act="ctab" data-t="${t}" class="${ui.ct === t ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const opts = (arr, cur, all) => `<option value="">${all}</option>` + arr.map(o => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("");
  h += `<div class="addform"><input type="text" data-f="cq" placeholder="Buscar cliente, contato, cidade, equipamento…" value="${esc(ui.cq)}" autocomplete="off">
    <select data-f="cf" data-k="cfT" aria-label="Tipo de cliente">${opts(CTYPES, ui.cfT, "Todos os tipos")}</select>
    <select data-f="cf" data-k="cfS" aria-label="Serviço">${opts(SERVICES, ui.cfS, "Todos os serviços")}</select>
    <button class="btn primary" data-act="cnew">${ui.cNew ? "Fechar" : "+ Novo cliente"}</button>
    <button class="btn" data-act="ccsv">CSV</button></div>`;
  if (ui.cNew) h += newLeadForm();
  return h + `<div id="clist">${salesList()}</div>`;
}

function newLeadForm(){
  const sel = (name, arr) => `<select name="${name}">${arr.map(o => `<option>${esc(o)}</option>`).join("")}</select>`;
  return `<form class="pf" data-form="lead">
    <label class="fld wide">Cliente / empresa *<input type="text" name="text" required placeholder="Nome do cliente, construtora, empresa…"></label>
    <label class="fld">Pessoa de contato<input type="text" name="contact"></label>
    <label class="fld">Telefone / WhatsApp<input type="tel" name="phone"></label>
    <label class="fld">E-mail<input type="email" name="email"></label>
    <label class="fld">Cidade / bairro<input type="text" name="city"></label>
    <label class="fld">Tipo de cliente${sel("ctype", CTYPES)}</label>
    <label class="fld">Tipo de serviço${sel("service", SERVICES)}</label>
    <label class="fld">Tipo de equipamento<input type="text" name="equip" placeholder="Ex.: ar-condicionado, gerador, compressor…"></label>
    <label class="fld">Como chegou até nós${sel("origin", ORIGINS)}</label>
    <label class="fld">Valor estimado (R$)<input type="number" name="value" min="0" step="0.01"></label>
    <label class="fld">Próximo contato<input type="date" name="next" value="${todayIso()}"></label>
    <label class="fld wide">Observações<textarea name="notes" rows="2"></textarea></label>
    <div class="bt"><button type="button" class="btn" data-act="cnew">Cancelar</button><button type="submit" class="btn primary">Cadastrar cliente</button></div></form>`;
}

function filteredLeads(){
  const q = ui.cq.trim().toLowerCase();
  return state.crm.leads.filter(l => (!ui.cfT || l.ctype === ui.cfT) && (!ui.cfS || l.service === ui.cfS) &&
    (!q || [l.name, l.contact, l.phone, l.city, l.equip, l.notes].join(" ").toLowerCase().includes(q)));
}
const nextCell = l => { const t = todayIso(); return l.next ? `<span style="${isActive(l) && l.next < t ? "color:var(--danger);font-weight:700" : ""}">${fmtD(l.next)}${isActive(l) && l.next < t ? " ⚠" : ""}</span>` : "—"; };
const quickBtns = l => `${l.phone ? `<a class="ib" href="tel:${digits(l.phone)}" title="Ligar" aria-label="Ligar">📞</a>` : ""}${waLink(l.phone) ? `<a class="ib" href="${waLink(l.phone)}" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">💬</a>` : ""}`;

function salesList(){
  const leads = filteredLeads();
  if (!state.crm.leads.length) return `<div class="empty">Nenhum cliente cadastrado.<br>Clique em “+ Novo cliente” para começar a prospectar.</div>`;
  if (!leads.length) return `<div class="empty">Nenhum cliente com esse filtro.</div>`;
  if (ui.ct === "funil") {
    return `<div class="kb">` + STAGES.map(([k, label, cl], idx) => {
      const col = leads.filter(l => l.stage === k).sort((a, b) => (a.next || "9").localeCompare(b.next || "9"));
      return `<div class="kcol"><div class="kh"><span class="pill ${cl}">${label}</span><small>${col.length} · ${brl(col.reduce((a, l) => a + l.value, 0))}</small></div>` +
        (col.map(l => `<div class="kc" data-act="copen" data-id="${l.id}"><b>${esc(l.name)}</b>
          <small>${esc(l.service)}${l.equip ? " · " + esc(l.equip) : ""}</small><small>${esc(l.ctype)}${l.city ? " · " + esc(l.city) : ""}</small>
          <div class="kf"><span>${l.value ? brl(l.value) : ""}</span><span>${l.next ? "📅 " + nextCell(l) : ""}</span></div>
          <div class="kb2">${idx > 0 ? `<button class="ib" data-act="cmove" data-d="-1" data-id="${l.id}" aria-label="Etapa anterior">◀</button>` : ""}${quickBtns(l)}
          ${idx < STAGES.length - 1 ? `<button class="ib" data-act="cmove" data-d="1" data-id="${l.id}" aria-label="Próxima etapa">▶</button>` : ""}</div></div>`).join("") || `<div class="kempty">—</div>`) + `</div>`;
    }).join("") + `</div>`;
  }
  if (ui.ct === "agenda") {
    const t = todayIso(), wk = addDays(t, 7);
    const act = leads.filter(l => isActive(l)).sort((a, b) => (a.next || "9").localeCompare(b.next || "9"));
    const groups = [["⚠ Atrasados", l => l.next && l.next < t], ["📞 Hoje", l => l.next === t], ["📅 Próximos 7 dias", l => l.next > t && l.next <= wk],
      ["🗓 Mais adiante", l => l.next > wk], ["Sem data de retorno", l => !l.next]];
    return groups.map(([title, fn]) => {
      const g = act.filter(fn); if (!g.length) return "";
      return `<div class="sub" style="margin-top:6px">${title} (${g.length})</div><ul>` + g.map(l => `<li class="clk" data-act="copen" data-id="${l.id}">
        <div class="t"><b>${esc(l.name)}</b> <span class="pill ${stageOf(l.stage)[2]}">${stageOf(l.stage)[1]}</span>
          <small>${[l.contact, l.service, l.equip].filter(Boolean).map(esc).join(" · ")}${l.next ? " · retorno " + fmtD(l.next) : ""}</small></div>${quickBtns(l)}</li>`).join("") + `</ul>`;
    }).join("") || `<div class="empty">Nenhum contato pendente. 🎉</div>`;
  }
  return `<div class="tw"><table class="os"><tr><th>Cliente</th><th>Tipo</th><th>Serviço / equipamento</th><th>Etapa</th><th class="r">Valor</th><th>Próx. contato</th><th></th></tr>` +
    leads.sort((a, b) => (isActive(b) - isActive(a)) || (a.next || "9").localeCompare(b.next || "9")).map(l => `<tr class="clk" data-act="copen" data-id="${l.id}">
      <td><b>${esc(l.name)}</b><small>${[l.contact, l.city].filter(Boolean).map(esc).join(" · ")}</small></td><td>${esc(l.ctype)}</td>
      <td>${esc(l.service)}<small>${esc(l.equip)}</small></td><td><span class="pill ${stageOf(l.stage)[2]}">${stageOf(l.stage)[1]}</span></td>
      <td class="r">${l.value ? brl(l.value) : "—"}</td><td>${nextCell(l)}</td><td class="act">${quickBtns(l)}</td></tr>`).join("") + `</table></div>`;
}

/* ---------- detalhe do cliente ---------- */
function salesDetail(l){
  const f = (label, k, type = "text", extra = "", cls = "") =>
    `<label class="fld ${cls}">${label}<input type="${type}" data-f="cl" data-k="${k}" data-id="${l.id}" value="${esc(l[k])}" ${extra}></label>`;
  const sel = (label, k, arr) => `<label class="fld">${label}<select data-f="cl" data-k="${k}" data-id="${l.id}">${arr.map(o => `<option ${o === l[k] ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  const map = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([l.address, l.city].filter(Boolean).join(" "));
  let h = `<div class="nav"><button data-act="cback">← Voltar</button>
    <div class="ttl">${esc(l.name)} <span class="pill ${stageOf(l.stage)[2]}">${stageOf(l.stage)[1]}</span></div><span style="width:44px"></span></div>`;
  h += `<div class="row2">${l.phone ? `<a class="btn" href="tel:${digits(l.phone)}">📞 Ligar</a>` : ""}${waLink(l.phone) ? `<a class="btn" href="${waLink(l.phone)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
    ${l.email ? `<a class="btn" href="mailto:${esc(l.email)}">✉ E-mail</a>` : ""}${l.address || l.city ? `<a class="btn" href="${map}" target="_blank" rel="noopener">📍 Mapa</a>` : ""}</div>`;
  h += `<div class="seg wrap">${STAGES.map(([k, label]) => `<button data-act="cstage" data-v="${k}" class="${l.stage === k ? "on" : ""}">${label}</button>`).join("")}</div>`;
  if (l.stage === "perdido") h += `<div class="warn">Motivo da perda: ${esc(l.lost || "não informado")}</div>`;
  h += `<div class="sec"><h4>👤 Cliente</h4><div class="g">
    ${f("Cliente / empresa", "name", "text", "", "wide")}${f("Pessoa de contato", "contact")}${f("Telefone / WhatsApp", "phone", "tel")}${f("E-mail", "email", "email")}
    ${f("Cidade / bairro", "city")}${f("Endereço", "address", "text", "", "wide")}</div></div>`;
  h += `<div class="sec"><h4>🎯 Oportunidade</h4><div class="g">
    ${sel("Tipo de cliente", "ctype", CTYPES)}${sel("Tipo de serviço", "service", SERVICES)}${f("Tipo de equipamento", "equip")}${sel("Como chegou até nós", "origin", ORIGINS)}
    ${f("Valor estimado (R$)", "value", "number", 'min="0" step="0.01"')}${f("Próximo contato", "next", "date")}
    <label class="fld">Prioridade<select data-f="cl" data-k="pri" data-id="${l.id}">${[["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]].map(([o, n]) => `<option value="${o}" ${l.pri === o ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <label class="fld wide">Observações<textarea data-f="cl" data-k="notes" data-id="${l.id}" rows="3">${esc(l.notes)}</textarea></label></div></div>`;
  h += `<div class="sec"><h4>📞 Histórico de contatos</h4>
    <form class="pf" data-form="int"><label class="fld">Tipo de contato<select name="type">${INTERACTIONS.map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <label class="fld">Próximo contato<input type="date" name="next" value="${l.next || ""}"></label>
      <label class="fld wide">O que foi conversado<textarea name="text" rows="2" required placeholder="Resumo da conversa, combinados, objeções…"></textarea></label>
      <div class="bt"><button type="submit" class="btn primary">Registrar contato</button></div></form>
    <ul class="tl">${l.log.map(x => `<li><b>${fmtDT(x.d)}</b> · ${intLabel(x.type)}<br>${esc(x.text)}</li>`).join("") || "<li>Nenhum contato registrado ainda.</li>"}</ul>
    <div class="meta">Cadastrado em ${new Date(l.c).toLocaleDateString("pt-BR")}</div></div>`;
  return h + `<button class="danger" data-act="cdel">Excluir cliente</button>`;
}

/* ---------- ações ---------- */
function salesClick(a, D, c){
  if (a === "ctab") { ui.ct = D.t; renderPanel(); return true; }
  if (a === "cnew") { ui.cNew = !ui.cNew; renderPanel(); return true; }
  if (a === "copen") { ui.cOpen = D.id; renderPanel(); panel.scrollTop = 0; return true; }
  if (a === "cback") { ui.cOpen = null; renderPanel(); return true; }
  if (a === "cmove") {
    const l = c.leads.find(x => x.id === D.id), idx = STAGES.findIndex(s => s[0] === l.stage) + +D.d;
    if (idx >= 0 && idx < STAGES.length && setStage(l, STAGES[idx][0])) refresh();
    return true;
  }
  if (a === "ccsv") {
    const head = ["Cliente", "Contato", "Telefone", "E-mail", "Cidade", "Tipo de cliente", "Serviço", "Equipamento", "Origem", "Etapa", "Valor", "Próximo contato", "Observações"];
    const rows = c.leads.map(l => [l.name, l.contact, l.phone, l.email, l.city, l.ctype, l.service, l.equip, l.origin, stageOf(l.stage)[1], l.value, l.next, l.notes]);
    const csv = [head, ...rows].map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const el = document.createElement("a");
    el.href = URL.createObjectURL(new Blob(["﻿" + csv], { type:"text/csv;charset=utf-8" }));
    el.download = `clientes-${todayIso()}.csv`; el.click(); URL.revokeObjectURL(el.href); return true;
  }
  const l = c.leads.find(x => x.id === ui.cOpen);
  if (!l) return false;
  if (a === "cstage") { if (setStage(l, D.v)) refresh(); return true; }
  if (a === "cdel") {
    if (!confirm(`Excluir o cliente "${l.name}" e todo o histórico?`)) return true;
    c.leads = c.leads.filter(x => x !== l); ui.cOpen = null; refresh(); return true;
  }
  return false;
}

function salesChange(e, f, c){
  const t = e.target;
  if (f === "cf") { ui[t.dataset.k] = t.value; renderPanel(); return; }
  const l = c.leads.find(x => x.id === t.dataset.id); if (!l || f !== "cl") return;
  const k = t.dataset.k;
  l[k] = t.type === "number" ? Math.max(0, num(t.value)) : t.value;
  save(); render();
  if (k === "next" || k === "pri") renderPanel();
}

function salesSubmit(form, fd, c){
  const kind = form.dataset.form, g = k => (fd.get(k) || "").trim();
  if (kind === "lead") {
    const name = g("text"); if (!name) return;
    const l = normCrm({ leads:[{ id:uid(), name, contact:g("contact"), phone:g("phone"), email:g("email"), city:g("city"), ctype:g("ctype"), service:g("service"),
      equip:g("equip"), origin:g("origin"), value:num(fd.get("value")), next:g("next"), notes:g("notes"), c:Date.now() }] }).leads[0];
    llog(l, "obs", "Cliente cadastrado");
    c.leads.push(l); ui.cNew = false; ui.cOpen = l.id; refresh(); panel.scrollTop = 0; return;
  }
  const l = c.leads.find(x => x.id === ui.cOpen); if (!l) return;
  if (kind === "int") {
    const text = g("text"); if (!text) return;
    llog(l, g("type"), text);
    l.next = g("next");
    if (l.stage === "novo" && g("type") !== "obs") llog(l, "etapa", `${stageOf("novo")[1]} → ${stageOf("contatado")[1]}`), l.stage = "contatado";
    refresh();
  }
}
