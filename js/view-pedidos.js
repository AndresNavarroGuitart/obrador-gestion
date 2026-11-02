/* Módulo Pedidos: tablero, lista, producción consolidada, detalle con pagos, comprobantes y consumo de stock. */
(function () {
  const OB = window.OB;
  const { esc, money } = OB;
  OB.vs.pedidos = { vista: 'tablero', q: '', filtro: 'proximos', desde: OB.today(), hasta: OB.addDays(OB.today(), 14), conNuevos: false };

  OB.packLabel = (p) => {
    const pata = p.items.some((i) => i.rid === 'v_pata'); const bon = p.items.some((i) => i.rid === 'v_bondiola');
    const extras = p.items.some((i) => !['v_pata', 'v_bondiola'].includes(i.rid));
    return (pata && bon ? 'Mix' : pata ? 'Pata' : bon ? 'Bondiola' : 'A medida') + (extras ? ' + extras' : '');
  };
  const matches = (p, q) => !q || (p.cliente + ' ' + p.num + ' ' + p.tel + ' ' + (p.codigo || '')).toLowerCase().includes(q.toLowerCase());
  const flags = (p) => `${p.origen === 'web' ? '<span class="chip info">Web</span> ' : ''}${p.editadoAt ? '<span class="chip">Editado</span> ' : ''}${p.comprobantes && p.comprobantes.length ? `<span class="chip">📎 ${p.comprobantes.length}</span>` : ''}`;

  const card = (p) => {
    const t = OB.pTotals(p); const hoy = p.fecha === OB.today(); const f = flags(p);
    return `<div class="pcard ${hoy ? 'today' : ''}" draggable="true" data-id="${p.id}" data-act="ped-open">
      <div class="top"><span>${OB.fdate(p.fecha)} · ${p.hora}</span><span>${p.codigo ? '#' + p.codigo : p.num}</span></div>
      <div class="nm">${esc(p.cliente)}</div>
      <div class="muted" style="font-size:13px">${p.invitados} invitados · ${OB.packLabel(p)}</div>
      ${f ? `<div style="margin-top:5px">${f}</div>` : ''}
      <div class="bt"><span class="strong num">${money(t.total)}</span>${OB.pagoChip(t)}</div></div>`;
  };

  const listaFiltrada = () => {
    const v = OB.vs.pedidos; const hoy = OB.today();
    let list = OB.s.pedidos.filter((p) => matches(p, v.q) && p.estado !== 'cancelado');
    if (v.filtro === 'proximos') list = list.filter((p) => p.fecha >= hoy && p.estado !== 'entregado');
    else if (v.filtro === 'cobrar') list = list.filter((p) => OB.pTotals(p).saldo > 0.5);
    else if (v.filtro === 'entregados') list = list.filter((p) => p.estado === 'entregado');
    return list.sort((a, b) => (v.filtro === 'proximos' ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha)));
  };

  /* producción consolidada: qué hay que hacer entre dos fechas */
  const produccion = () => {
    const v = OB.vs.pedidos;
    const ped = OB.s.pedidos.filter((p) => p.fecha >= v.desde && p.fecha <= v.hasta && (['confirmado', 'produccion'].includes(p.estado) || (v.conNuevos && p.estado === 'nuevo'))).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
    const m = new Map();
    ped.forEach((p) => p.items.forEach((i) => { const r = m.get(i.rid) || { nombre: i.nombre, q: 0, n: 0, venta: 0, costo: 0 }; r.q += i.q; r.n += 1; r.venta += i.q * i.precio; r.costo += i.q * i.costo; m.set(i.rid, r); }));
    return { ped, rows: [...m.values()].sort((a, b) => b.venta - a.venta) };
  };
  const tabProduccion = () => {
    const v = OB.vs.pedidos; const { ped, rows } = produccion();
    const tot = rows.reduce((a, r) => ({ venta: a.venta + r.venta, costo: a.costo + r.costo }), { venta: 0, costo: 0 });
    const porDia = {}; ped.forEach((p) => { (porDia[p.fecha] = porDia[p.fecha] || []).push(p); });
    return `<div class="card" style="margin-bottom:14px"><div class="frow" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr)) auto auto;align-items:end">
      <label class="f">Desde<input type="date" value="${v.desde}" data-change="prod-desde"></label><label class="f">Hasta<input type="date" value="${v.hasta}" data-change="prod-hasta"></label>
      <label style="display:flex;gap:7px;align-items:center;font-size:13px;min-height:38px"><input type="checkbox" data-change="prod-nuevos" ${v.conNuevos ? 'checked' : ''}> incluir “por confirmar”</label>
      <button class="btn" data-act="prod-csv">Exportar CSV</button></div></div>
      ${ped.length ? `<div class="grid g2" style="align-items:start"><div class="card tbl-wrap"><div class="card-head"><h2>Para producir</h2><span class="muted">${ped.length} pedidos</span></div><table><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">En pedidos</th><th class="r">Venta</th><th class="r">Costo MP</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="strong">${esc(r.nombre)}</td><td class="r num strong">${r.q}</td><td class="r num muted">${r.n}</td><td class="r num">${money(r.venta)}</td><td class="r num">${money(r.costo)}</td></tr>`).join('')}<tr><td class="strong">Total</td><td></td><td></td><td class="r num strong">${money(tot.venta)}</td><td class="r num strong">${money(tot.costo)}</td></tr></tbody></table><p class="muted" style="font-size:13px;margin:12px 0 0">Los insumos a comprar para estos pedidos están en <a href="#/stock" data-act="go" data-r="stock">Stock → Lista de compras</a>.</p></div>
      <div class="card"><h2 style="margin-bottom:8px">Por día</h2>${Object.entries(porDia).map(([f, l]) => `<div style="margin-bottom:12px"><b class="strong">${OB.fdate(f)}</b>${l.map((p) => `<div class="alert" style="cursor:pointer;padding:7px 0" data-act="ped-open" data-id="${p.id}"><span class="muted" style="width:44px">${p.hora}</span><span style="flex:1"><span class="strong">${esc(p.cliente)}</span><span class="muted"> · ${p.invitados} inv. · ${OB.packLabel(p)}</span></span>${OB.estadoChip(p.estado)}</div>`).join('')}</div>`).join('')}</div></div>` : '<div class="card empty">No hay pedidos confirmados en ese rango de fechas.</div>'}`;
  };

  const results = () => {
    const v = OB.vs.pedidos; const hoy = OB.today();
    if (v.vista === 'produccion') return tabProduccion();
    if (v.vista === 'tablero') {
      const all = OB.s.pedidos.filter((p) => matches(p, v.q));
      const cols = OB.ESTADOS.map((e) => {
        let list = all.filter((p) => p.estado === e.id);
        if (e.id === 'entregado') list = list.filter((p) => p.fecha >= OB.addDays(hoy, -14) || OB.pTotals(p).saldo > 0).sort((a, b) => b.fecha.localeCompare(a.fecha));
        else list.sort((a, b) => a.fecha.localeCompare(b.fecha));
        return `<div class="col" data-estado="${e.id}"><div class="col-h"><span class="t">${e.label}</span><span class="c">${list.length}</span></div>${list.map(card).join('') || '<div class="muted" style="font-size:13px">Arrastrá un pedido acá</div>'}</div>`;
      }).join('');
      return `<div class="kanban">${cols}</div>`;
    }
    const list = listaFiltrada();
    if (!list.length) return '<div class="card empty">No hay pedidos con este filtro.</div>';
    return `<div class="card tbl-wrap"><table><thead><tr><th>N°</th><th>Evento</th><th>Cliente</th><th class="r">Inv.</th><th>Estado</th><th class="r">Total</th><th>Cobro</th><th class="r">Margen</th></tr></thead><tbody>${list.map((p) => {
      const t = OB.pTotals(p);
      return `<tr class="click" data-act="ped-open" data-id="${p.id}"><td class="muted">${p.num}${p.codigo ? '<br>#' + p.codigo : ''}</td><td>${OB.fdate(p.fecha)}</td><td class="strong">${esc(p.cliente)}<div style="font-weight:400">${flags(p)}</div></td><td class="r num">${p.invitados}</td><td>${OB.estadoChip(p.estado)}</td><td class="r num strong">${money(t.total)}</td><td>${OB.pagoChip(t)}</td><td class="r num">${OB.pct(t.margenPct)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  };

  OB.views.pedidos = () => {
    const v = OB.vs.pedidos; const hoy = OB.today();
    const activos = OB.s.pedidos.filter((p) => ['nuevo', 'confirmado', 'produccion'].includes(p.estado));
    const comp = activos.reduce((a, p) => a + OB.pTotals(p).total, 0); const cobrado = activos.reduce((a, p) => a + OB.pTotals(p).pagado, 0);
    const nuevos = OB.s.pedidos.filter((p) => p.estado === 'nuevo').length; const prox = activos.filter((p) => p.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    return `<div class="page-head"><div><h1>Pedidos</h1><p>${nuevos ? nuevos + ' esperando seña · ' : ''}arrastrá las tarjetas para cambiar de estado.</p></div>
      <div class="actions"><a class="btn" href="#/pedir" target="_blank" rel="noopener">Formulario del cliente ↗</a><button class="btn primary" data-act="ped-new">${OB.ic('plus')}Nuevo pedido</button></div></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><span class="l">Pedidos activos</span><span class="v">${activos.length}</span><span class="s">${activos.reduce((a, p) => a + p.invitados, 0)} invitados · próximo ${prox ? OB.fdate(prox.fecha) : '—'}</span></div>
        <div class="card kpi"><span class="l">Comprometido</span><span class="v">${money(comp)}</span><span class="s">en pedidos sin entregar</span></div>
        <div class="card kpi"><span class="l">Cobrado (señas)</span><span class="v up">${money(cobrado)}</span><span class="s">${OB.pct(comp ? cobrado / comp : 0)} de lo comprometido</span></div>
        <div class="card kpi"><span class="l">Saldo a cobrar</span><span class="v">${money(comp - cobrado)}</span><span class="s">al entregar</span></div></div>
      <div class="toolbar"><div class="tabs" role="tablist"><button class="${v.vista === 'tablero' ? 'on' : ''}" data-act="ped-vista" data-v="tablero">Tablero</button><button class="${v.vista === 'lista' ? 'on' : ''}" data-act="ped-vista" data-v="lista">Lista</button><button class="${v.vista === 'produccion' ? 'on' : ''}" data-act="ped-vista" data-v="produccion">Producción</button></div>
        ${v.vista !== 'produccion' ? `<input class="search" type="search" placeholder="Buscar cliente, N° o código" value="${esc(v.q)}" data-input="ped-q" aria-label="Buscar pedidos">` : ''}
        ${v.vista === 'lista' ? `<select style="width:auto" data-change="ped-filtro" aria-label="Filtro"><option value="proximos" ${v.filtro === 'proximos' ? 'selected' : ''}>Próximos eventos</option><option value="cobrar" ${v.filtro === 'cobrar' ? 'selected' : ''}>Con saldo por cobrar</option><option value="entregados" ${v.filtro === 'entregados' ? 'selected' : ''}>Entregados</option><option value="todos" ${v.filtro === 'todos' ? 'selected' : ''}>Todos</option></select><button class="btn sm" data-act="ped-csv">Exportar CSV</button>` : ''}</div>
      <div id="ped-results">${results()}</div>`;
  };

  OB.inputs['ped-q'] = (el) => { OB.vs.pedidos.q = el.value; document.getElementById('ped-results').innerHTML = results(); };
  OB.changes['ped-filtro'] = (el) => { OB.vs.pedidos.filtro = el.value; OB.render(); };
  OB.changes['prod-desde'] = (el) => { if (el.value) { OB.vs.pedidos.desde = el.value; OB.render(); } };
  OB.changes['prod-hasta'] = (el) => { if (el.value) { OB.vs.pedidos.hasta = el.value; OB.render(); } };
  OB.changes['prod-nuevos'] = (el) => { OB.vs.pedidos.conNuevos = el.checked; OB.render(); };
  OB.actions['ped-vista'] = (el) => { OB.vs.pedidos.vista = el.dataset.v; OB.render(); };
  OB.actions['ped-new'] = () => OB.openEventForm('pedido', { fecha: OB.addDays(OB.today(), 14), zona: 'cba', invitados: 20, items: [] });

  OB.actions['ped-csv'] = () => {
    const rows = [['Pedido', 'Código', 'Fecha evento', 'Cliente', 'Teléfono', 'Invitados', 'Estado', 'Productos', 'Total', 'Pagado', 'Saldo', 'Costo MP', 'Margen', 'Origen', 'Notas']];
    listaFiltrada().forEach((p) => { const t = OB.pTotals(p); rows.push([p.num, p.codigo || '', p.fecha, p.cliente, p.tel, p.invitados, OB.ESTADO_LABEL[p.estado], p.items.map((i) => `${i.q}× ${i.nombre}`).join(' + '), Math.round(t.total), Math.round(t.pagado), Math.round(t.saldo), Math.round(t.cmv), Math.round(t.margen), p.origen === 'web' ? 'Web' : 'Interno', p.notas]); });
    OB.csv(`pedidos-obrador-${OB.today()}.csv`, rows);
  };
  OB.actions['prod-csv'] = () => {
    const v = OB.vs.pedidos; const { rows } = produccion();
    OB.csv(`produccion-${v.desde}_${v.hasta}.csv`, [['Producto', 'Cantidad', 'En pedidos', 'Venta', 'Costo MP'], ...rows.map((r) => [r.nombre, r.q, r.n, Math.round(r.venta), Math.round(r.costo)])]);
  };

  /* ---------- drag & drop del tablero ---------- */
  let dragId = null;
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('.pcard'); if (!c) return; dragId = c.dataset.id; c.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
  document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('.pcard'); if (c) c.classList.remove('drag'); document.querySelectorAll('.col.over').forEach((x) => x.classList.remove('over')); });
  document.addEventListener('dragover', (e) => { const c = e.target.closest && e.target.closest('.col'); if (!c || !dragId) return; e.preventDefault(); document.querySelectorAll('.col.over').forEach((x) => x !== c && x.classList.remove('over')); c.classList.add('over'); });
  document.addEventListener('drop', (e) => {
    const c = e.target.closest && e.target.closest('.col'); if (!c || !dragId) return; e.preventDefault();
    const p = OB.s.pedidos.find((x) => x.id === dragId); dragId = null; if (!p || p.estado === c.dataset.estado) { OB.render(); return; }
    OB.changeEstado(p, c.dataset.estado);
  });

  OB.changeEstado = (p, est) => {
    const before = p.consumido;
    OB.setEstado(p, est);
    OB.save(); OB.render();
    if (OB.drawerId === p.id) OB.drawerPedido(p.id);
    OB.toast(!before && p.consumido ? 'En producción · stock descontado según recetas' : before && !p.consumido ? 'Stock restituido' : 'Pedido ' + OB.ESTADO_LABEL[est].toLowerCase());
  };

  /* ---------- detalle ---------- */
  const comprobantesHTML = (p) => {
    const c = p.comprobantes || [];
    return `<div class="card-head"><h3>Comprobantes</h3><label class="btn sm" style="cursor:pointer">${OB.ic('plus')}Adjuntar<input type="file" accept="image/*,application/pdf" multiple hidden data-change="comp-add"></label></div>
      ${c.length ? c.map((x) => `<div class="comp"><div>${x.thumb ? `<img class="th" src="${x.thumb}" alt="" data-act="comp-ver">` : '<div class="pdf">PDF</div>'}</div><div><div class="strong" style="font-size:14px;word-break:break-all">${esc(x.name)}</div><div class="muted" style="font-size:12px">${OB.fdate(x.at.slice(0, 10))} · ${OB.num(x.size / 1024)} KB</div></div><button class="btn sm danger" data-act="comp-del" data-id="${x.id}">Quitar</button>${x.thumb ? `<img class="big hide" src="${x.thumb}" alt="Comprobante ${esc(x.name)}">` : ''}</div>`).join('') : '<div class="muted" style="font-size:13.5px">Sin comprobantes. Podés adjuntar fotos o PDF de la transferencia (hasta 10, 4 MB c/u).</div>'}`;
  };
  OB.drawerPedido = (id) => {
    const p = OB.s.pedidos.find((x) => x.id === id); if (!p) { OB.closeModal(); return; }
    OB.drawerId = id; OB.draft = null;
    const t = OB.pTotals(p); const idx = OB.ESTADOS.findIndex((e) => e.id === p.estado);
    const prev = OB.ESTADOS[idx - 1]; const next = OB.ESTADOS[idx + 1];
    const zona = OB.s.config.zonas.find((z) => z.id === p.zona)?.nombre || '';
    const needs = [...OB.needs(p.items)].map(([i, q]) => ({ ins: OB.ins(i), q })).filter((x) => x.ins).sort((a, b) => b.q * b.ins.costo - a.q * a.ins.costo);
    const msg = `¡Hola ${p.cliente.split(' ')[0]}! Te confirmo tu pedido de Obrador para el ${OB.fdate(p.fecha)} a las ${p.hora} (${p.invitados} invitados). Total: ${money(t.total)}.${t.saldo > 0 ? ' Saldo pendiente: ' + money(t.saldo) + '.' : ' ¡Ya está todo abonado!'} ¡Gracias!`;
    const body = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px"><div><div class="strong" style="font:700 20px Montserrat">${esc(p.cliente)}</div><div class="muted">${p.num}${p.codigo ? ' · #' + p.codigo : ''} · ${OB.packLabel(p)}</div><div style="margin-top:4px">${flags(p)}</div></div>${OB.estadoChip(p.estado)}</div>
      <dl class="kv"><dt>Evento</dt><dd>${OB.fdate(p.fecha)} · ${p.hora}</dd><dt>Invitados</dt><dd>${p.invitados}</dd><dt>Zona</dt><dd>${esc(zona)}</dd><dt>WhatsApp</dt><dd>${esc(p.tel) || '—'}</dd>${p.presupuesto ? `<dt>Origen</dt><dd>Presupuesto ${p.presupuesto}</dd>` : ''}${p.entregadoAt ? `<dt>Entregado</dt><dd>${OB.fdate(p.entregadoAt.slice(0, 10))}</dd>` : ''}${p.editadoAt ? `<dt>Editado</dt><dd>${OB.fdate(p.editadoAt.slice(0, 10))}</dd>` : ''}${p.notas ? `<dt>Notas</dt><dd>${esc(p.notas)}</dd>` : ''}</dl>
      <hr class="sep"><h3 style="margin-bottom:8px">Estado del pedido</h3>
      <div class="actions">${prev ? `<button class="btn sm" data-act="ped-estado" data-e="${prev.id}">${OB.ic('back')}${prev.label}</button>` : ''}${next ? `<button class="btn sm primary" data-act="ped-estado" data-e="${next.id}">${next.label}${OB.ic('next')}</button>` : ''}</div>
      <p class="muted" style="font-size:12.5px;margin:8px 0 0">${p.consumido ? 'Los insumos de este pedido ya se descontaron del stock.' : 'Al pasar a “En producción” se descuentan los insumos del stock según las recetas.'}</p>
      <hr class="sep"><h3 style="margin-bottom:8px">Detalle</h3>
      <div class="items">${p.items.map((i) => `<div class="item" style="grid-template-columns:1fr auto auto"><span class="strong">${i.q}× ${esc(i.nombre)}</span><span class="muted num">${money(i.precio)}</span><span class="num strong">${money(i.q * i.precio)}</span></div>`).join('')}</div>
      <div class="tot"><div><span>Subtotal</span><span class="num">${money(t.sub)}</span></div><div><span>Envío</span><span class="num">${money(p.envio)}</span></div>${p.desc ? `<div><span>Descuento</span><span class="num">− ${money(p.desc)}</span></div>` : ''}<div class="big"><span>Total</span><span class="num">${money(t.total)}</span></div><div class="muted" style="font-size:12.5px"><span>Costo MP ${money(t.cmv)} · margen ${money(t.margen)} (${OB.pct(t.margenPct)})</span></div></div>
      <hr class="sep"><div class="card-head"><h3>Cobros</h3>${OB.pagoChip(t)}</div>
      ${p.pagos.length ? p.pagos.map((x) => `<div class="alert"><div style="flex:1"><span class="strong num">${money(x.monto)}</span> <span class="muted">· ${esc(x.medio)} · ${OB.fdate(x.fecha)}</span></div><button class="x" data-act="pago-del" data-id="${x.id}" aria-label="Quitar pago">${OB.ic('trash')}</button></div>`).join('') : `<div class="muted" style="font-size:13.5px">Todavía no hay pagos registrados. Seña sugerida: <b class="strong">${money(OB.senaDe(t.total))}</b>.</div>`}
      ${t.saldo > 0.5 ? `<form data-submit="pago-add" class="frow" style="margin-top:12px;grid-template-columns:1fr 1fr auto;align-items:end"><label class="f">Monto<input type="number" name="monto" min="1" value="${Math.round(p.pagos.length ? t.saldo : Math.min(t.saldo, OB.senaDe(t.total)))}" required></label><label class="f">Medio<select name="medio">${OB.MEDIOS.map((m) => `<option>${m}</option>`).join('')}</select></label><button class="btn primary" type="submit">${OB.ic('cash')}Registrar</button></form>` : ''}
      <hr class="sep">${comprobantesHTML(p)}
      <details style="margin-top:18px"><summary class="strong" style="cursor:pointer">Insumos necesarios (${needs.length})</summary><div class="tbl-wrap" style="margin-top:8px"><table><tbody>${needs.map((n) => `<tr><td>${esc(n.ins.nombre)}</td><td class="r num">${OB.num(n.q, 2)} ${n.ins.unidad}</td><td class="r num muted">stock ${OB.num(n.ins.stock, 1)}</td></tr>`).join('')}</tbody></table></div></details>`;
    const foot = `<button class="btn danger sm" data-act="ped-cancel">${p.estado === 'cancelado' ? 'Reactivar' : 'Cancelar pedido'}</button><button class="btn danger sm" data-act="ped-del">${OB.ic('trash')}</button><button class="btn sm" data-act="ped-edit">${OB.ic('edit')}Editar</button>${p.tel ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${OB.waLink(p.tel, msg)}">${OB.ic('wa')}WhatsApp</a>` : ''}`;
    OB.modal(p.num, body, foot, { side: true });
  };
  const cur = () => OB.s.pedidos.find((x) => x.id === OB.drawerId);
  OB.actions['ped-open'] = (el) => OB.drawerPedido(el.dataset.id);
  OB.actions['ped-estado'] = (el) => OB.changeEstado(cur(), el.dataset.e);
  OB.actions['ped-edit'] = () => OB.openEventForm('pedido', cur());
  OB.actions['ped-cancel'] = () => {
    const p = cur();
    if (p.estado === 'cancelado') OB.setEstado(p, 'nuevo'); else { if (!confirm('¿Cancelar este pedido?')) return; p.estado = 'cancelado'; }
    OB.save(); OB.render(); OB.drawerPedido(p.id);
  };
  OB.actions['ped-del'] = (el) => {
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = '¿Borrar? Tocá de nuevo'; return; }
    const p = cur(); if (p.consumido) OB.restituir(p);
    OB.s.pedidos = OB.s.pedidos.filter((x) => x.id !== p.id); OB.save(); OB.closeModal(); OB.render(); OB.toast('Pedido borrado');
  };
  OB.actions['pago-del'] = (el) => { const p = cur(); p.pagos = p.pagos.filter((x) => x.id !== el.dataset.id); OB.save(); OB.render(); OB.drawerPedido(p.id); };
  OB.submits['pago-add'] = (f) => { const p = cur(); OB.addPago(p, +f.elements.monto.value, f.elements.medio.value); OB.save(); OB.render(); OB.drawerPedido(p.id); OB.toast('Pago registrado'); };

  /* comprobantes: en producción irían a un storage; acá solo se guarda una miniatura */
  OB.changes['comp-add'] = async (el) => {
    const p = cur(); p.comprobantes = p.comprobantes || []; let added = 0;
    for (const f of [...el.files]) {
      if (p.comprobantes.length >= 10) { OB.toast('Máximo 10 comprobantes por pedido'); break; }
      if (f.size > 4 * 1024 * 1024) { OB.toast(f.name + ' supera los 4 MB'); continue; }
      if (!/^image\//.test(f.type) && f.type !== 'application/pdf') { OB.toast(f.name + ': solo fotos o PDF'); continue; }
      const thumb = f.type.startsWith('image/') ? await OB.thumb(f) : null;
      p.comprobantes.push({ id: OB.uid(), name: f.name, type: f.type, size: f.size, at: new Date().toISOString(), thumb }); added++;
    }
    if (added && !OB.save()) OB.toast('Sin espacio en el preview: la miniatura no se guardó');
    else if (added) OB.toast(added + (added === 1 ? ' comprobante adjuntado' : ' comprobantes adjuntados'));
    OB.render(); OB.drawerPedido(p.id);
  };
  OB.actions['comp-ver'] = (el) => { const b = el.closest('.comp').querySelector('.big'); if (b) b.classList.toggle('hide'); };
  OB.actions['comp-del'] = (el) => {
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = '¿Seguro?'; return; }
    const p = cur(); p.comprobantes = p.comprobantes.filter((x) => x.id !== el.dataset.id); OB.save(); OB.render(); OB.drawerPedido(p.id);
  };
})();
