/* Junta dois "documentos compartilhados" (estoque / manutenções) item a item,
   para que o painel do dono e o celular do Davi nunca sobrescrevam um ao outro. */
(function (root) {
  const ts = o => (o && +o.u) || 0;

  // a = versão do servidor, b = versão de quem está enviando.
  // lockMeta: o remetente (Davi) não pode mudar nome/descrição do card.
  function mergeShared(a, b, lockMeta) {
    a = a || {}; b = b || {};
    const del = {};
    [a.del, b.del].forEach(d => Object.keys(d || {}).forEach(k => { del[k] = Math.max(del[k] || 0, +d[k] || 0); }));

    const map = new Map();
    [...(a.items || []), ...(b.items || [])].forEach(i => {
      if (!i || !i.id) return;
      const o = map.get(i.id);
      if (!o || ts(i) > ts(o)) map.set(i.id, i);
    });
    const items = [...map.values()].filter(i => !(del[i.id] > 0 && del[i.id] >= ts(i)));

    const mv = new Map();
    [...(a.moves || []), ...(b.moves || [])].forEach(m => { if (m && m.id && !mv.has(m.id)) mv.set(m.id, m); });
    const moves = [...mv.values()].filter(m => !(del[m.pid] > 0))
      .sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 3000);

    const m = lockMeta ? (a.name !== undefined ? a : b) : (b.name !== undefined ? b : a);
    return { name: m.name, role: m.role, items, moves, del };
  }

  root.Merge = { mergeShared };
})(typeof globalThis !== "undefined" ? globalThis : this);
