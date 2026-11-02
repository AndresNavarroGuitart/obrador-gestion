/* Módulo Presupuestos: armado de packs, envío por WhatsApp, documento imprimible y conversión a pedido. */
(function () {
  const OB = window.OB;
  const { esc, money } = OB;
  OB.vs.presupuestos = { filtro: 'todos' };

  const estadoReal = (q) => (q.estado === 'enviado' && q.vence < OB.today() ? 'vencido' : q.estado);
  const chip = (q) => {
    const e = estadoReal(q);
    const cls = { borrador: '', enviado: 'info', aceptado: 'ok', rechazado: 'bad', vencido: 'warn' }[e];
    return `<span class="chip ${cls}">${{ borrador: 'Borrador', enviado: 'Enviado', aceptado: 'Aceptado', rechazado: 'Rechazado', vencido: 'Vencido' }[e]}</span>`;
  };
  const waText = (q) => {
    const t = OB.pTotals(q);
    return `¡Hola ${q.cliente.split(' ')[0]}! 👋 Te paso el presupuesto de Obrador para tu evento del ${OB.fdate(q.fecha)} (${q.invitados} invitados):\n\n${q.items.map((i) => `• ${i.q}× ${i.nombre}: ${money(i.q * i.precio)}`).join('\n')}\n${q.envio ? `• Envío: ${money(q.envio)}\n` : '• Envío: sin cargo\n'}${q.desc ? `• Descuento: − ${money(q.desc)}\n` : ''}\n*Total: ${money(t.total)}*\nVálido hasta el ${OB.fdate(q.vence)}.\n\nPara reservar la fecha pedimos una seña del ${OB.s.config.negocio.senaPct}% (${money(OB.senaDe(t.total))}):\nAlias: ${OB.s.config.negocio.alias}\nCVU: ${OB.s.config.negocio.cvu}\nTitular: ${OB.s.config.negocio.titular}\n\n¡Cualquier cambio lo ajustamos!`;
  };

  OB.views.presupuestos = () => {
    const f = OB.vs.presupuestos.filtro; const qs = OB.s.presupuestos;
    const pend = qs.filter((q) => estadoReal(q) === 'enviado');
    const pendTotal = pend.reduce((a, q) => a + OB.pTotals(q).total, 0);
    const cerrados = qs.filter((q) => ['aceptado', 'rechazado', 'vencido'].includes(estadoReal(q)));
    const tasa = cerrados.length ? cerrados.filter((q) => q.estado === 'aceptado').length / cerrados.length : 0;
    let list = qs.slice().sort((a, b) => b.creado.localeCompare(a.creado) || b.num.localeCompare(a.num));
    if (f !== 'todos') list = list.filter((q) => estadoReal(q) === f);
    const filtros = [['todos', 'Todos'], ['borrador', 'Borradores'], ['enviado', 'Enviados'], ['aceptado', 'Aceptados'], ['rechazado', 'Rechazados'], ['vencido', 'Vencidos']];
    return `<div class="page-head"><div><h1>Presupuestos</h1><p>Armá el pack, mandalo por WhatsApp y, cuando aceptan, pasalo a pedido con un clic.</p></div>
      <div class="actions"><button class="btn primary" data-act="presu-new">${OB.ic('plus')}Nuevo presupuesto</button></div></div>
      <div class="grid g3" style="margin-bottom:16px">
        <div class="card kpi"><span class="l">Esperando respuesta</span><span class="v">${pend.length}</span><span class="s">${money(pendTotal)} en juego</span></div>
        <div class="card kpi"><span class="l">Tasa de aceptación</span><span class="v">${cerrados.length ? OB.pct(tasa) : '—'}</span><span class="s">sobre ${cerrados.length} presupuestos cerrados</span></div>
        <div class="card kpi"><span class="l">Aceptados</span><span class="v">${qs.filter((q) => q.estado === 'aceptado').length}</span><span class="s">ya convertidos en pedido</span></div></div>
      <div class="toolbar"><div class="tabs">${filtros.map(([id, l]) => `<button class="${f === id ? 'on' : ''}" data-act="presu-filtro" data-f="${id}">${l}</button>`).join('')}</div></div>
      ${list.length ? `<div class="card tbl-wrap"><table><thead><tr><th>N°</th><th>Cliente</th><th>Evento</th><th class="r">Inv.</th><th>Estado</th><th class="r">Total</th><th class="r">Margen</th><th>Vence</th></tr></thead><tbody>${list.map((q) => {
        const t = OB.pTotals(q);
        return `<tr class="click" data-act="presu-open" data-id="${q.id}"><td class="muted">${q.num}</td><td class="strong">${esc(q.cliente)}</td><td>${OB.fdate(q.fecha)}</td><td class="r num">${q.invitados}</td><td>${chip(q)}</td><td class="r num strong">${money(t.total)}</td><td class="r num">${OB.pct(t.margenPct)}</td><td class="muted">${OB.fdate(q.vence)}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="card empty">No hay presupuestos con este filtro.</div>'}`;
  };

  OB.actions['presu-filtro'] = (el) => { OB.vs.presupuestos.filtro = el.dataset.f; OB.render(); };
  OB.actions['presu-new'] = () => OB.openEventForm('presupuesto', { fecha: OB.addDays(OB.today(), 21), zona: 'cba', invitados: 30, items: [] });

  OB.drawerPresu = (id) => {
    const q = OB.s.presupuestos.find((x) => x.id === id); if (!q) { OB.closeModal(); return; }
    OB.drawerId = id; OB.draft = null; const t = OB.pTotals(q); const abierto = !['aceptado', 'rechazado'].includes(q.estado);
    const body = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px"><div><div class="strong" style="font:700 20px Montserrat">${esc(q.cliente)}</div><div class="muted">${q.num} · creado ${OB.fdate(q.creado)}</div></div>${chip(q)}</div>
      <dl class="kv"><dt>Evento</dt><dd>${OB.fdate(q.fecha)} · ${q.hora}</dd><dt>Invitados</dt><dd>${q.invitados}</dd><dt>WhatsApp</dt><dd>${esc(q.tel) || '—'}</dd><dt>Válido hasta</dt><dd>${OB.fdate(q.vence)}</dd>${q.notas ? `<dt>Notas</dt><dd>${esc(q.notas)}</dd>` : ''}</dl>
      <hr class="sep"><div class="items">${q.items.map((i) => `<div class="item" style="grid-template-columns:1fr auto auto"><span class="strong">${i.q}× ${esc(i.nombre)}</span><span class="muted num">${money(i.precio)}</span><span class="num strong">${money(i.q * i.precio)}</span></div>`).join('')}</div>
      <div class="tot"><div><span>Subtotal</span><span class="num">${money(t.sub)}</span></div><div><span>Envío</span><span class="num">${money(q.envio)}</span></div>${q.desc ? `<div><span>Descuento</span><span class="num">− ${money(q.desc)}</span></div>` : ''}<div class="big"><span>Total</span><span class="num">${money(t.total)}</span></div><div class="muted" style="font-size:12.5px"><span>Interno: margen ${money(t.margen)} (${OB.pct(t.margenPct)})</span></div></div>
      ${q.estado === 'aceptado' && q.pedidoId ? `<p style="margin-top:14px"><button class="btn sm" data-act="ped-open" data-id="${q.pedidoId}">Ver pedido generado</button></p>` : ''}`;
    const foot = `<button class="btn danger sm" data-act="presu-del">${OB.ic('trash')}</button>
      ${abierto ? `<button class="btn sm" data-act="presu-rechazar">Rechazado</button><button class="btn sm" data-act="presu-edit">${OB.ic('edit')}Editar</button>` : ''}
      <button class="btn sm" data-act="presu-doc">${OB.ic('print')}Documento</button>
      ${abierto && q.tel ? `<a class="btn sm wa" target="_blank" rel="noopener" data-act="presu-enviado" href="${OB.waLink(q.tel, waText(q))}">${OB.ic('wa')}Enviar</a>` : ''}
      ${abierto ? `<button class="btn sm primary" data-act="presu-aceptar">${OB.ic('check')}Aceptado → pedido</button>` : ''}`;
    OB.modal(q.num, body, foot, { side: true });
  };
  OB.actions['presu-open'] = (el) => OB.drawerPresu(el.dataset.id);
  const cur = () => OB.s.presupuestos.find((x) => x.id === OB.drawerId);
  OB.actions['presu-edit'] = () => OB.openEventForm('presupuesto', cur());
  OB.actions['presu-enviado'] = (el, e) => { e.stopPropagation(); const q = cur(); if (q.estado === 'borrador') { q.estado = 'enviado'; OB.save(); OB.render(); setTimeout(() => OB.drawerPresu(q.id), 50); } window.open(el.href, '_blank', 'noopener'); };
  OB.actions['presu-rechazar'] = () => { const q = cur(); q.estado = 'rechazado'; OB.save(); OB.render(); OB.drawerPresu(q.id); };
  OB.actions['presu-del'] = () => { if (!confirm('¿Eliminar el presupuesto?')) return; OB.s.presupuestos = OB.s.presupuestos.filter((x) => x.id !== OB.drawerId); OB.save(); OB.closeModal(); OB.render(); };
  OB.actions['presu-aceptar'] = () => {
    const q = cur(); const p = OB.aceptarPresupuesto(q);
    OB.save(); OB.render(); OB.drawerPedido(p.id); OB.toast('Pedido ' + p.num + ' creado · falta registrar la seña');
  };
  OB.actions['presu-doc'] = () => {
    const q = cur(); const t = OB.pTotals(q);
    const body = `<div id="print-doc" class="doc"><img src="https://obrador.ar/assets/img/logo-light.png" alt="Obrador"><h2>Presupuesto ${q.num}</h2><small>Para ${esc(q.cliente)} · ${OB.fdate(q.fecha)} a las ${q.hora} · ${q.invitados} invitados</small>
      <table style="margin-top:14px"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr></thead><tbody>${q.items.map((i) => `<tr><td>${esc(i.nombre)}</td><td class="r">${i.q}</td><td class="r">${money(i.precio)}</td><td class="r">${money(i.q * i.precio)}</td></tr>`).join('')}<tr><td>Envío</td><td></td><td></td><td class="r">${q.envio ? money(q.envio) : 'Sin cargo'}</td></tr>${q.desc ? `<tr><td>Descuento</td><td></td><td></td><td class="r">− ${money(q.desc)}</td></tr>` : ''}</tbody></table>
      <div class="tt">Total ${money(t.total)}</div><p><small>Todo llega en bandejas listas para calentar y servir. Presupuesto válido hasta el ${OB.fdate(q.vence)}. Cobertura: Córdoba Capital y Sierras Chicas.</small></p>
      <p style="margin:12px 0 0;padding:10px 12px;background:#f4efe6;border-radius:8px"><b>Para reservar la fecha:</b> seña del ${OB.s.config.negocio.senaPct}% (${money(OB.senaDe(t.total))}).<br><small>Alias: ${esc(OB.s.config.negocio.alias)} · CVU: ${esc(OB.s.config.negocio.cvu)} · Titular: ${esc(OB.s.config.negocio.titular)}</small></p></div>`;
    OB.modal('Documento para el cliente', body, `<button class="btn ghost" data-act="close">Cerrar</button><button class="btn primary" onclick="window.print()">${OB.ic('print')}Imprimir / guardar PDF</button>`, { wide: true, noFocus: true });
  };
})();
