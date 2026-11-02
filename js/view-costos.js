/* Módulo Costos: materia prima, recetas, márgenes por producto y simulador de aumentos. */
(function () {
  const OB = window.OB;
  const { esc, money, num } = OB;
  OB.vs.costos = { tab: 'margenes', simCat: 'Carnes', simPct: 10 };

  const semaforo = (m) => { const o = OB.s.config.margenObjetivo / 100; return m.netoPct >= o ? 'ok' : m.netoPct >= o - 0.12 ? 'warn' : 'bad'; };
  const ventas = () => OB.s.recetas.filter((r) => r.tipo === 'venta');

  const tabMargenes = () => {
    const c = OB.s.config;
    return `<div class="card" style="margin-bottom:16px"><div class="frow" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr)) auto;align-items:end">
      <label class="f">Margen neto objetivo (%)<input type="number" min="0" max="95" value="${c.margenObjetivo}" data-change="cfg-margen"></label>
      <label class="f">Costos indirectos sobre MP (%)<input type="number" min="0" max="100" value="${c.indirectosPct}" data-change="cfg-ind"></label>
      <span class="muted" style="font-size:12.5px;max-width:320px">Indirectos: gas, mano de obra y packaging que no están en la receta. El margen neto descuenta ese porcentaje.</span></div></div>
      <div class="card tbl-wrap"><table><thead><tr><th>Producto</th><th class="r">Precio</th><th class="r">Costo MP</th><th class="r">Margen bruto</th><th class="r">Neto est.</th><th>Estado</th><th class="r">Precio sugerido</th><th></th></tr></thead><tbody>${ventas().map((r) => {
        const m = OB.recMargen(r); const s = semaforo(m); const sug = Math.ceil(m.sugerido / 50) * 50;
        return `<tr class="click" data-act="rec-open" data-id="${r.id}"><td class="strong">${esc(r.nombre)}<div class="muted" style="font-size:12px;font-weight:400">por ${r.unidad}</div></td><td class="r num">${money(r.precio)}</td><td class="r num">${money(m.costo)}</td><td class="r num">${money(m.bruto)} <span class="muted">(${OB.pct(m.brutoPct)})</span></td><td class="r num strong">${OB.pct(m.netoPct)}</td><td><span class="chip ${s}">${s === 'ok' ? 'En objetivo' : s === 'warn' ? 'Ajustado' : 'Bajo objetivo'}</span></td><td class="r num">${sug > r.precio ? `<span class="warn-t">${money(sug)}</span>` : '<span class="muted">—</span>'}</td><td class="r">${sug > r.precio ? `<button class="btn sm" data-act="rec-sug" data-id="${r.id}" data-p="${sug}">Aplicar</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>
      <div style="margin-top:12px"><button class="btn" data-act="rec-new">${OB.ic('plus')}Nueva receta o producto</button></div>`;
  };

  const usadoEn = (insId) => ventas().filter((r) => OB.needs([{ rid: r.id, q: 1 }]).has(insId)).length;
  const tabMP = () => {
    const cats = [...new Set(OB.s.insumos.map((i) => i.cat))]; const v = OB.vs.costos;
    return `<div class="card tbl-wrap" style="margin-bottom:16px"><table><thead><tr><th>Insumo</th><th>Categoría</th><th class="r">Costo actual</th><th class="r">Anterior</th><th class="r">Variación</th><th class="r">Usado en</th></tr></thead><tbody>${OB.s.insumos.map((i) => {
      const d = i.costoAnt ? (i.costo - i.costoAnt) / i.costoAnt : 0;
      return `<tr><td class="strong">${esc(i.nombre)}</td><td class="muted">${i.cat}</td><td class="r"><span style="display:inline-flex;align-items:center;gap:6px">$<input type="number" min="0" step="any" value="${i.costo}" style="width:100px;padding:4px 8px;min-height:30px;text-align:right" data-change="ins-costo" data-id="${i.id}" aria-label="Costo de ${esc(i.nombre)}"> / ${i.unidad}</span></td><td class="r num muted">${money(i.costoAnt)}</td><td class="r num ${d > 0.005 ? 'down' : d < -0.005 ? 'up' : 'muted'}">${d > 0 ? '▲' : d < 0 ? '▼' : ''} ${Math.abs(Math.round(d * 100))}%</td><td class="r num muted">${usadoEn(i.id)} productos</td></tr>`;
    }).join('')}</tbody></table></div>
      <div class="card"><div class="card-head"><div><h2>Simulador de aumentos</h2><p class="muted" style="margin:2px 0 0;font-size:13.5px">¿Qué le pasa al margen si sube una categoría? Probalo antes de aplicarlo.</p></div></div>
      <div class="frow" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr)) auto auto;align-items:end"><label class="f">Categoría<select data-change="sim-cat"><option value="todas" ${v.simCat === 'todas' ? 'selected' : ''}>Todas</option>${cats.map((c) => `<option ${v.simCat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="f">Aumento (%)<input type="number" value="${v.simPct}" data-change="sim-pct"></label><button class="btn primary" data-act="sim-apply">Aplicar aumento</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Producto</th><th class="r">Margen neto hoy</th><th class="r">Con el aumento</th><th class="r">Diferencia</th></tr></thead><tbody>${simulate().map((s) => `<tr><td class="strong">${esc(s.r.nombre)}</td><td class="r num">${OB.pct(s.antes)}</td><td class="r num strong">${OB.pct(s.despues)}</td><td class="r num ${s.despues < s.antes - 0.004 ? 'down' : 'muted'}">${s.despues < s.antes ? '−' : ''}${Math.abs(Math.round((s.despues - s.antes) * 100))} pts</td></tr>`).join('')}</tbody></table></div></div>`;
  };
  const simulate = () => {
    const v = OB.vs.costos; const f = 1 + (+v.simPct || 0) / 100;
    const orig = new Map(OB.s.insumos.map((i) => [i.id, i.costo]));
    const antes = ventas().map((r) => OB.recMargen(r).netoPct);
    OB.s.insumos.forEach((i) => { if (v.simCat === 'todas' || i.cat === v.simCat) i.costo = i.costo * f; });
    const res = ventas().map((r, k) => ({ r, antes: antes[k], despues: OB.recMargen(r).netoPct }));
    OB.s.insumos.forEach((i) => { i.costo = orig.get(i.id); });
    return res;
  };

  OB.views.costos = () => {
    const v = OB.vs.costos; const m = ventas().map((r) => OB.recMargen(r)); const bajo = m.filter((x) => x.netoPct < OB.s.config.margenObjetivo / 100).length;
    const prom = m.reduce((a, x) => a + x.netoPct, 0) / (m.length || 1);
    return `<div class="page-head"><div><h1>Costos y márgenes</h1><p>Cada producto se arma con una receta; el costo se recalcula solo cuando cambia la materia prima.</p></div></div>
      <div class="grid g3" style="margin-bottom:16px"><div class="card kpi"><span class="l">Margen neto promedio</span><span class="v">${OB.pct(prom)}</span><span class="s">objetivo ${OB.s.config.margenObjetivo}%</span></div>
        <div class="card kpi"><span class="l">Productos bajo objetivo</span><span class="v ${bajo ? 'down' : 'up'}">${bajo}</span><span class="s">de ${m.length} productos de venta</span></div>
        <div class="card kpi"><span class="l">Materia prima que más subió</span><span class="v" style="font-size:19px">${(() => { const t = OB.s.insumos.filter((i) => i.costoAnt).map((i) => ({ i, d: (i.costo - i.costoAnt) / i.costoAnt })).sort((a, b) => b.d - a.d)[0]; return t ? esc(t.i.nombre) : '—'; })()}</span><span class="s">${(() => { const t = OB.s.insumos.filter((i) => i.costoAnt).map((i) => ({ i, d: (i.costo - i.costoAnt) / i.costoAnt })).sort((a, b) => b.d - a.d)[0]; return t ? '▲ ' + Math.round(t.d * 100) + '% vs. compra anterior' : ''; })()}</span></div></div>
      <div class="toolbar"><div class="tabs"><button class="${v.tab === 'margenes' ? 'on' : ''}" data-act="costos-tab" data-t="margenes">Márgenes por producto</button><button class="${v.tab === 'mp' ? 'on' : ''}" data-act="costos-tab" data-t="mp">Materia prima y simulador</button></div></div>
      ${v.tab === 'margenes' ? tabMargenes() : tabMP()}`;
  };

  OB.actions['costos-tab'] = (el) => { OB.vs.costos.tab = el.dataset.t; OB.render(); };
  OB.changes['cfg-margen'] = (el) => { OB.s.config.margenObjetivo = Math.min(95, +el.value || 0); OB.save(); OB.render(); };
  OB.changes['cfg-ind'] = (el) => { OB.s.config.indirectosPct = +el.value || 0; OB.save(); OB.render(); };
  OB.changes['ins-costo'] = (el) => { const i = OB.ins(el.dataset.id); const n = +el.value; if (n >= 0 && n !== i.costo) { i.costoAnt = i.costo; i.costo = n; OB.save(); OB.render(); OB.toast('Costo actualizado · márgenes recalculados'); } };
  OB.changes['sim-cat'] = (el) => { OB.vs.costos.simCat = el.value; OB.render(); };
  OB.changes['sim-pct'] = (el) => { OB.vs.costos.simPct = +el.value || 0; OB.render(); };
  OB.actions['sim-apply'] = () => {
    const v = OB.vs.costos; const f = 1 + (+v.simPct || 0) / 100;
    if (!confirm(`¿Aplicar ${v.simPct}% de aumento a ${v.simCat === 'todas' ? 'todos los insumos' : v.simCat}?`)) return;
    OB.s.insumos.forEach((i) => { if (v.simCat === 'todas' || i.cat === v.simCat) { i.costoAnt = i.costo; i.costo = Math.round(i.costo * f); } });
    OB.save(); OB.render(); OB.toast('Aumento aplicado');
  };
  OB.actions['rec-sug'] = (el, e) => { e.stopPropagation(); OB.rec(el.dataset.id).precio = +el.dataset.p; OB.save(); OB.render(); OB.toast('Precio actualizado'); };

  /* ---------- editor de receta ---------- */
  const lineCost = (l) => (l.t === 'i' ? (OB.ins(l.id)?.costo || 0) * l.q : OB.costRec(l.id) * l.q);
  const lineName = (l) => (l.t === 'i' ? OB.ins(l.id)?.nombre : OB.rec(l.id)?.nombre);
  const lineUnit = (l) => (l.t === 'i' ? OB.ins(l.id)?.unidad : 'porción');
  const rLines = () => OB.rd.lineas.map((l, i) => `<div class="item" style="grid-template-columns:1fr 90px 100px 28px"><span class="strong">${esc(lineName(l))} <span class="muted">(${lineUnit(l)})</span></span><input type="number" min="0" step="any" value="${l.q}" data-input="rd-q" data-i="${i}" aria-label="Cantidad"><span class="num right" id="rl-${i}">${money(lineCost(l))}</span><button type="button" class="x" data-act="rd-del" data-i="${i}" aria-label="Quitar">${OB.ic('x')}</button></div>`).join('') || '<div class="empty">Sin ingredientes.</div>';
  const rSummary = () => {
    const costo = OB.rd.lineas.reduce((a, l) => a + lineCost(l), 0); const precio = +document.getElementById('rd-precio')?.value || 0;
    const ind = costo * OB.s.config.indirectosPct / 100;
    document.getElementById('rd-sum').innerHTML = `<div><span>Costo materia prima</span><span class="num">${money(costo)}</span></div>${OB.rd.tipo === 'venta' ? `<div><span>Margen bruto</span><span class="num">${money(precio - costo)} (${OB.pct(precio ? (precio - costo) / precio : 0)})</span></div><div class="big"><span>Margen neto estimado</span><span class="num">${OB.pct(precio ? (precio - costo - ind) / precio : 0)}</span></div>` : ''}`;
  };
  OB.actions['rec-open'] = (el) => openRec(OB.rec(el.dataset.id));
  OB.actions['rec-new'] = () => openRec({ id: '', nombre: '', tipo: 'venta', unidad: 'unidad', precio: 0, lineas: [] });
  const openRec = (r) => {
    OB.rd = { id: r.id, tipo: r.tipo, lineas: JSON.parse(JSON.stringify(r.lineas)) };
    const opts = `<optgroup label="Insumos">${OB.s.insumos.map((i) => `<option value="i:${i.id}">${esc(i.nombre)} (${i.unidad})</option>`).join('')}</optgroup><optgroup label="Recetas base">${OB.s.recetas.filter((x) => x.tipo === 'base' && x.id !== r.id).map((x) => `<option value="r:${x.id}">${esc(x.nombre)}</option>`).join('')}</optgroup>`;
    OB.modal(r.id ? 'Receta · ' + r.nombre : 'Nueva receta', `<form id="rform" data-submit="rec-save" autocomplete="off">
      <div class="frow"><label class="f">Nombre<input name="nombre" required value="${esc(r.nombre)}"></label><label class="f">Se vende por<input name="unidad" value="${esc(r.unidad)}"></label>
        ${r.tipo === 'venta' ? `<label class="f">Precio de venta ($)<input type="number" min="0" id="rd-precio" name="precio" value="${r.precio}" data-input="rd-precio"></label>` : ''}
        ${r.id ? '' : `<label class="f">Tipo<select name="tipo" data-change="rd-tipo"><option value="venta">Producto de venta</option><option value="base">Receta base (sub-receta)</option></select></label>`}</div>
      <h3 style="margin:6px 0 8px">Ingredientes (por ${esc(r.unidad)})</h3><div class="items" id="rd-lines">${rLines()}</div>
      <div class="add-line"><select id="rd-add">${opts}</select><input type="number" id="rd-addq" value="1" step="any" min="0" aria-label="Cantidad"><button type="button" class="btn" data-act="rd-add">${OB.ic('plus')}Agregar</button></div>
      <div class="tot" id="rd-sum"></div></form>`,
    `${r.id ? `<button class="btn danger" data-act="rec-del" style="margin-right:auto">Eliminar</button>` : ''}<button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" type="submit" form="rform">Guardar</button>`, { wide: true });
    rSummary();
  };
  OB.inputs['rd-precio'] = () => rSummary();
  OB.changes['rd-tipo'] = (el) => { OB.rd.tipo = el.value; rSummary(); };
  OB.inputs['rd-q'] = (el) => { const i = +el.dataset.i; OB.rd.lineas[i].q = +el.value || 0; document.getElementById('rl-' + i).textContent = money(lineCost(OB.rd.lineas[i])); rSummary(); };
  OB.actions['rd-del'] = (el) => { OB.rd.lineas.splice(+el.dataset.i, 1); document.getElementById('rd-lines').innerHTML = rLines(); rSummary(); };
  OB.actions['rd-add'] = () => {
    const [t, id] = document.getElementById('rd-add').value.split(':'); const q = +document.getElementById('rd-addq').value || 0;
    if (!q) return; const ex = OB.rd.lineas.find((l) => l.t === t && l.id === id);
    if (ex) ex.q += q; else OB.rd.lineas.push({ t, id, q });
    document.getElementById('rd-lines').innerHTML = rLines(); rSummary();
  };
  OB.submits['rec-save'] = (f) => {
    const tipo = OB.rd.id ? OB.rd.tipo : f.elements.tipo.value; let r = OB.rec(OB.rd.id);
    if (!r) { r = { id: (tipo === 'venta' ? 'v_' : 'r_') + OB.uid(), tipo, precio: 0 }; OB.s.recetas.push(r); }
    r.nombre = f.elements.nombre.value.trim(); r.unidad = f.elements.unidad.value.trim() || 'unidad';
    if (r.tipo === 'venta' && f.elements.precio) r.precio = +f.elements.precio.value || 0;
    r.lineas = OB.rd.lineas.filter((l) => l.q > 0);
    OB.save(); OB.closeModal(); OB.render(); OB.toast('Receta guardada');
  };
  OB.actions['rec-del'] = () => {
    const id = OB.rd.id; const enUso = OB.s.recetas.some((x) => x.id !== id && x.lineas.some((l) => l.t === 'r' && l.id === id));
    if (enUso) { OB.toast('No se puede eliminar: la usan otras recetas'); return; }
    if (!confirm('¿Eliminar esta receta? Los pedidos ya cargados conservan su precio y costo.')) return;
    OB.s.recetas = OB.s.recetas.filter((x) => x.id !== id); OB.save(); OB.closeModal(); OB.render();
  };
})();
