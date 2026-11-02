/* Módulo Stock: inventario, lista de compras según pedidos confirmados y movimientos. */
(function () {
  const OB = window.OB;
  const { esc, money, num } = OB;
  OB.vs.stock = { tab: 'inventario', cat: 'todas', q: '', conNuevos: false, vista: 'insumo', tipo: 'todos' };

  const estado = (i) => (i.stock <= 0 ? ['bad', 'Sin stock'] : i.stock <= i.minimo ? ['warn', 'Bajo mínimo'] : ['ok', 'OK']);

  /* tipo de pedido = principal (pata / bondiola / mix / a medida) + opción (simple / completa) */
  const TIPOS = [['todos', 'Todos los tipos'], ['pata', 'Pata'], ['bondiola', 'Bondiola'], ['mix', 'Mix'], ['medida', 'A medida'], ['simple', 'Opción simple'], ['completa', 'Opción completa']];
  const TLABEL = { pata: 'Pata', bondiola: 'Bondiola', mix: 'Mix', medida: 'A medida', simple: 'Simple', completa: 'Completa' };
  OB.tipoPedido = (p) => {
    const pata = p.items.some((i) => i.rid === 'v_pata'); const bon = p.items.some((i) => i.rid === 'v_bondiola');
    return { principal: pata && bon ? 'mix' : pata ? 'pata' : bon ? 'bondiola' : 'medida', opcion: p.items.some((i) => !['v_pata', 'v_bondiola'].includes(i.rid)) ? 'completa' : 'simple' };
  };
  const tipoOk = (p, t) => { if (t === 'todos') return true; const x = OB.tipoPedido(p); return x.principal === t || x.opcion === t; };
  const tipoLabel = (p) => { const x = OB.tipoPedido(p); return TLABEL[x.principal] + ' · ' + TLABEL[x.opcion]; };

  const compras = (ignoreTipo) => {
    const v = OB.vs.stock;
    let ped = OB.s.pedidos.filter((p) => !p.consumido && (p.estado === 'confirmado' || (v.conNuevos && p.estado === 'nuevo')));
    if (!ignoreTipo) ped = ped.filter((p) => tipoOk(p, v.tipo));
    const filtrado = !ignoreTipo && v.tipo !== 'todos';
    const need = OB.needs(ped.flatMap((p) => p.items));
    const rows = OB.s.insumos.map((i) => {
      const n = need.get(i.id) || 0;
      const comprar = Math.max(0, n + i.minimo - i.stock);
      const q = i.unidad === 'u' ? Math.ceil(comprar) : Math.ceil(comprar * 10) / 10;
      return { i, n, q, costo: q * i.costo };
    }).filter((r) => r.q > 0 && (!filtrado || r.n > 0)).sort((a, b) => a.i.proveedor.localeCompare(b.i.proveedor) || b.costo - a.costo);
    return { ped, rows };
  };
  /* insumos que necesita un grupo de pedidos, sin considerar el mínimo de stock */
  const needRows = (peds) => [...OB.needs(peds.flatMap((p) => p.items))].map(([id, q]) => ({ i: OB.ins(id), q })).filter((r) => r.i)
    .map((r) => ({ ...r, costo: r.q * r.i.costo })).sort((a, b) => b.costo - a.costo);
  const grupos = (ped) => {
    const v = OB.vs.stock;
    if (v.vista === 'pedido') return ped.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((p) => ({ titulo: `${OB.fdate(p.fecha)} · ${p.cliente}`, sub: `${p.invitados} invitados · ${tipoLabel(p)} · ${OB.ESTADO_LABEL[p.estado]}`, peds: [p] }));
    const m = new Map();
    ped.forEach((p) => { const k = tipoLabel(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
    return [...m].map(([k, peds]) => ({ titulo: k, sub: `${peds.length} pedido${peds.length === 1 ? '' : 's'} · ${peds.reduce((a, p) => a + p.invitados, 0)} invitados`, peds })).sort((a, b) => needRows(b.peds).reduce((s, r) => s + r.costo, 0) - needRows(a.peds).reduce((s, r) => s + r.costo, 0));
  };
  const textoGrupos = () => grupos(compras().ped).map((g) => `*${g.titulo}* (${g.sub})\n${needRows(g.peds).map((r) => `• ${r.i.nombre}: ${num(r.q, 2)} ${r.i.unidad}`).join('\n')}`).join('\n\n');

  const tabInventario = () => {
    const v = OB.vs.stock;
    let list = OB.s.insumos.filter((i) => (v.cat === 'todas' || i.cat === v.cat) && (!v.q || i.nombre.toLowerCase().includes(v.q.toLowerCase())));
    list = list.slice().sort((a, b) => (a.stock <= a.minimo ? 0 : 1) - (b.stock <= b.minimo ? 0 : 1) || a.nombre.localeCompare(b.nombre));
    return `<div class="card tbl-wrap"><table><thead><tr><th>Insumo</th><th>Categoría</th><th class="r">Stock</th><th class="r">Mínimo</th><th>Estado</th><th class="r">Costo unit.</th><th class="r">Valor</th><th>Proveedor</th><th></th></tr></thead><tbody>${list.map((i) => {
      const [c, l] = estado(i);
      return `<tr><td class="strong">${esc(i.nombre)}</td><td class="muted">${i.cat}</td><td class="r num strong">${num(i.stock, 2)} ${i.unidad}</td><td class="r num muted">${num(i.minimo, 1)}</td><td><span class="chip ${c}">${l}</span></td><td class="r num">${money(i.costo)}</td><td class="r num">${money(i.stock * i.costo)}</td><td class="muted">${esc(i.proveedor)}</td><td class="r" style="white-space:nowrap"><button class="btn sm" data-act="stock-compra" data-id="${i.id}">Compra</button> <button class="btn sm ghost" data-act="stock-ajuste" data-id="${i.id}">Ajustar</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  };

  const tabCompras = () => {
    const { ped, rows } = compras(); const v = OB.vs.stock;
    const total = rows.reduce((a, r) => a + r.costo, 0);
    const head = `<div class="card-head"><div><h2>Lista de compras</h2><p class="muted" style="margin:2px 0 0;font-size:13.5px">${v.vista === 'insumo' ? `Cubre ${ped.length} pedido${ped.length === 1 ? '' : 's'} sin producir${v.tipo === 'todos' ? '' : ' del tipo elegido'} y deja el stock mínimo de cada insumo.` : `Insumos que necesita cada ${v.vista === 'pedido' ? 'pedido' : 'tipo de pedido'} (${ped.length} sin producir). No incluye el stock mínimo.`}</p></div>
      <div class="actions"><label style="display:flex;gap:7px;align-items:center;font-size:13px"><input type="checkbox" data-change="stock-nuevos" ${v.conNuevos ? 'checked' : ''}> incluir “por confirmar”</label><button class="btn sm" data-act="stock-copiar">Copiar lista</button></div></div>
      <div class="toolbar" style="margin:4px 0 12px"><span class="muted" style="font-size:13px;font-weight:700">Ver por</span><div class="tabs">${[['insumo', 'Insumo'], ['pedido', 'Pedido'], ['tipo', 'Tipo de pedido']].map(([id, l]) => `<button class="${v.vista === id ? 'on' : ''}" data-act="stock-vista" data-v="${id}">${l}</button>`).join('')}</div>
        <select style="width:auto" data-change="stock-tipo" aria-label="Filtrar por tipo de pedido">${TIPOS.map(([id, l]) => `<option value="${id}" ${v.tipo === id ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
    if (v.vista !== 'insumo') {
      const gs = grupos(ped);
      return `<div class="card" style="margin-bottom:14px">${head}</div>${gs.length ? gs.map((g) => { const rs = needRows(g.peds); return `<div class="card" style="margin-bottom:12px"><div class="card-head"><div><h3>${esc(g.titulo)}</h3><div class="muted" style="font-size:13px">${esc(g.sub)}</div></div><span class="strong num">${money(rs.reduce((a, r) => a + r.costo, 0))}</span></div><div class="tbl-wrap"><table><thead><tr><th>Insumo</th><th>Proveedor</th><th class="r">Necesario</th><th class="r">Stock actual</th><th class="r">Costo est.</th></tr></thead><tbody>${rs.map((r) => `<tr><td class="strong">${esc(r.i.nombre)}</td><td class="muted">${esc(r.i.proveedor)}</td><td class="r num">${num(r.q, 2)} ${r.i.unidad}</td><td class="r num ${r.q > r.i.stock ? 'down' : 'muted'}">${num(r.i.stock, 1)}${r.q > r.i.stock ? ' · falta' : ''}</td><td class="r num">${money(r.costo)}</td></tr>`).join('')}</tbody></table></div></div>`; }).join('') : '<div class="card empty">No hay pedidos sin producir de este tipo.</div>'}`;
    }
    return `<div class="card" style="margin-bottom:14px">${head}
      ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Proveedor</th><th>Insumo</th><th class="r">Stock</th><th class="r">Necesario</th><th class="r">Comprar</th><th class="r">Costo est.</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td class="muted">${esc(r.i.proveedor)}</td><td class="strong">${esc(r.i.nombre)}</td><td class="r num">${num(r.i.stock, 1)}</td><td class="r num">${num(r.n, 2)}</td><td class="r num strong">${num(r.q, 1)} ${r.i.unidad}</td><td class="r num">${money(r.costo)}</td><td class="r"><button class="btn sm" data-act="stock-compra" data-id="${r.i.id}" data-cant="${r.q}">Registrar</button></td></tr>`).join('')}</tbody></table></div>
      <div class="tot" style="margin-top:12px"><div class="big" style="border:0;padding:0;margin:0"><span>Inversión estimada</span><span class="num">${money(total)}</span></div></div>` : '<div class="empty">Nada para comprar: el stock alcanza para los pedidos confirmados.</div>'}</div>`;
  };

  const tabMovs = () => {
    const list = OB.s.movStock.slice().reverse().slice(0, 60);
    if (!list.length) return '<div class="card empty">Todavía no hay movimientos. Se generan al registrar compras, ajustes o al pasar un pedido a “En producción”.</div>';
    return `<div class="card tbl-wrap"><table><thead><tr><th>Fecha</th><th>Insumo</th><th>Tipo</th><th class="r">Cantidad</th><th>Referencia</th></tr></thead><tbody>${list.map((m) => {
      const i = OB.ins(m.insumoId);
      return `<tr><td>${OB.fdate(m.fecha)}</td><td class="strong">${esc(i?.nombre || '—')}</td><td><span class="chip ${m.tipo === 'ingreso' ? 'ok' : m.tipo === 'consumo' ? 'warn' : 'info'}">${m.tipo}</span></td><td class="r num ${m.cant < 0 ? 'down' : 'up'}">${m.cant > 0 ? '+' : ''}${num(m.cant, 2)} ${i?.unidad || ''}</td><td class="muted">${esc(m.ref)} ${esc(m.nota)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  };

  OB.views.stock = () => {
    const v = OB.vs.stock; const bajo = OB.stockBajo(); const valor = OB.s.insumos.reduce((a, i) => a + i.stock * i.costo, 0);
    const { rows } = compras(true); const cats =[...new Set(OB.s.insumos.map((i) => i.cat))];
    const body = v.tab === 'inventario' ? tabInventario() : v.tab === 'compras' ? tabCompras() : tabMovs();
    return `<div class="page-head"><div><h1>Stock</h1><p>Se descuenta solo cuando un pedido pasa a producción, según la receta de cada producto.</p></div>
      <div class="actions"><button class="btn primary" data-act="stock-compra">${OB.ic('plus')}Registrar compra</button></div></div>
      <div class="grid g3" style="margin-bottom:16px">
        <div class="card kpi"><span class="l">Valor del stock</span><span class="v">${money(valor)}</span><span class="s">${OB.s.insumos.length} insumos</span></div>
        <div class="card kpi"><span class="l">Bajo mínimo</span><span class="v ${bajo.length ? 'down' : ''}">${bajo.length}</span><span class="s">${bajo.slice(0, 3).map((i) => esc(i.nombre)).join(', ') || 'Todo en orden'}</span></div>
        <div class="card kpi"><span class="l">A comprar (pedidos confirmados)</span><span class="v">${money(rows.reduce((a, r) => a + r.costo, 0))}</span><span class="s">${rows.length} insumos en la lista</span></div></div>
      <div class="toolbar"><div class="tabs"><button class="${v.tab === 'inventario' ? 'on' : ''}" data-act="stock-tab" data-t="inventario">Inventario</button><button class="${v.tab === 'compras' ? 'on' : ''}" data-act="stock-tab" data-t="compras">Lista de compras</button><button class="${v.tab === 'movs' ? 'on' : ''}" data-act="stock-tab" data-t="movs">Movimientos</button></div>
        ${v.tab === 'inventario' ? `<input class="search" type="search" placeholder="Buscar insumo" value="${esc(v.q)}" data-input="stock-q" aria-label="Buscar insumo"><select style="width:auto" data-change="stock-cat" aria-label="Categoría"><option value="todas">Todas las categorías</option>${cats.map((c) => `<option ${v.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>` : ''}</div>
      <div id="stock-body">${body}</div>`;
  };

  OB.actions['stock-tab'] = (el) => { OB.vs.stock.tab = el.dataset.t; OB.render(); };
  OB.changes['stock-cat'] = (el) => { OB.vs.stock.cat = el.value; document.getElementById('stock-body').innerHTML = tabInventario(); };
  OB.inputs['stock-q'] = (el) => { OB.vs.stock.q = el.value; document.getElementById('stock-body').innerHTML = tabInventario(); };
  OB.changes['stock-nuevos'] = (el) => { OB.vs.stock.conNuevos = el.checked; OB.render(); };
  OB.actions['stock-vista'] = (el) => { OB.vs.stock.vista = el.dataset.v; OB.render(); };
  OB.changes['stock-tipo'] = (el) => { OB.vs.stock.tipo = el.value; OB.render(); };
  OB.actions['stock-copiar'] = () => {
    if (OB.vs.stock.vista !== 'insumo') { OB.copy(textoGrupos(), 'Lista copiada'); return; }
    const { rows } = compras(); const por = {};
    rows.forEach((r) => { (por[r.i.proveedor] = por[r.i.proveedor] || []).push(`• ${r.i.nombre}: ${num(r.q, 1)} ${r.i.unidad}`); });
    const txt = Object.entries(por).map(([p, l]) => `*${p}*\n${l.join('\n')}`).join('\n\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => OB.toast('Lista copiada'), () => OB.toast('No se pudo copiar'));
  };

  OB.actions['stock-compra'] = (el) => {
    const id = el.dataset.id || OB.s.insumos[0].id; const i0 = OB.ins(id);
    const opts = OB.s.insumos.map((i) => `<option value="${i.id}" ${i.id === id ? 'selected' : ''}>${esc(i.nombre)} (${i.unidad})</option>`).join('');
    OB.modal('Registrar compra', `<form id="cform" data-submit="compra-save" autocomplete="off">
      <div class="frow"><label class="f">Insumo<select name="insumo">${opts}</select></label><label class="f">Fecha<input type="date" name="fecha" value="${OB.today()}" required></label></div>
      <div class="frow"><label class="f">Cantidad<input type="number" name="cant" min="0.01" step="any" value="${el.dataset.cant || ''}" required></label><label class="f">Costo total ($)<input type="number" name="costo" min="1" required placeholder="${Math.round(i0.costo * (+el.dataset.cant || 1))}"></label></div>
      <label class="f">Proveedor<input name="prov" value="${esc(i0.proveedor)}"></label>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Suma al stock, actualiza el costo unitario del insumo (y con eso el margen de las recetas) y carga el gasto en Contable.</p></form>`,
    `<button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" type="submit" form="cform">Guardar compra</button>`);
  };
  OB.submits['compra-save'] = (f) => {
    OB.registrarCompra({ insumoId: f.elements.insumo.value, cant: +f.elements.cant.value, costoTotal: +f.elements.costo.value, proveedor: f.elements.prov.value.trim(), fecha: f.elements.fecha.value });
    OB.save(); OB.closeModal(); OB.render(); OB.toast('Compra registrada');
  };
  OB.actions['stock-ajuste'] = (el) => {
    const i = OB.ins(el.dataset.id);
    OB.modal('Ajustar stock · ' + i.nombre, `<form id="aform" data-submit="ajuste-save" autocomplete="off"><input type="hidden" name="id" value="${i.id}">
      <p class="muted" style="margin-top:0">Stock actual en sistema: <b class="strong">${num(i.stock, 2)} ${i.unidad}</b>. Cargá lo que contaste.</p>
      <div class="frow"><label class="f">Stock real (${i.unidad})<input type="number" name="real" step="any" min="0" value="${i.stock}" required></label><label class="f">Motivo<input name="nota" placeholder="Conteo, merma, vencimiento…"></label></div></form>`,
    `<button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" type="submit" form="aform">Guardar ajuste</button>`);
  };
  OB.submits['ajuste-save'] = (f) => {
    const i = OB.ins(f.elements.id.value); const real = +f.elements.real.value; const diff = Math.round((real - i.stock) * 1000) / 1000;
    if (diff) OB.s.movStock.push({ id: OB.uid(), fecha: OB.today(), insumoId: i.id, tipo: 'ajuste', cant: diff, ref: '', nota: f.elements.nota.value || 'Ajuste de inventario' });
    i.stock = real; OB.save(); OB.closeModal(); OB.render(); OB.toast('Stock ajustado');
  };
})();
