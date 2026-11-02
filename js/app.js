/* Router, navegación y guardado de formularios compartidos. */
(function () {
  const OB = window.OB;
  const ROUTES = [
    { id: 'resumen', label: 'Resumen', ic: 'home' },
    { id: 'pedidos', label: 'Pedidos', ic: 'bag' },
    { id: 'presupuestos', label: 'Presupuestos', ic: 'file' },
    { id: 'stock', label: 'Stock', ic: 'box' },
    { id: 'costos', label: 'Costos', ic: 'tag' },
    { id: 'contable', label: 'Contable', ic: 'chart' },
  ];
  const current = () => { const r = location.hash.replace('#/', ''); return r === 'pedir' || ROUTES.some((x) => x.id === r) ? r : 'resumen'; };

  OB.render = () => {
    const r = current();
    const pub = r === 'pedir';
    document.querySelector('.app').classList.toggle('public', pub);
    if (pub) { document.getElementById('main').innerHTML = OB.views.pedir(); document.title = 'Hacer pedido · Obrador'; return; }
    const badge = { stock: OB.stockBajo().length, pedidos: OB.s.pedidos.filter((p) => p.estado === 'nuevo').length };
    document.getElementById('nav').innerHTML = ROUTES.map((x) => `<a href="#/${x.id}" class="${x.id === r ? 'on' : ''}" ${x.id === r ? 'aria-current="page"' : ''}>${OB.ic(x.ic)}<span>${x.label}</span>${badge[x.id] ? `<span class="badge">${badge[x.id]}</span>` : ''}</a>`).join('');
    document.getElementById('main').innerHTML = `<div class="demo-note">Preview con datos de ejemplo (precios y recetas inventados a partir de la web). Todo es editable; los cambios quedan solo en este navegador.</div>` + OB.views[r]();
    document.title = 'Obrador · ' + ROUTES.find((x) => x.id === r).label;
  };

  window.addEventListener('hashchange', () => { OB.closeModal(); window.scrollTo(0, 0); OB.render(); });

  /* datos del negocio: transferencia, seña, envío */
  OB.actions.ajustes = () => {
    const c = OB.s.config; const n = c.negocio;
    OB.modal('Datos del negocio', `<form id="aform2" data-submit="ajustes-save" autocomplete="off">
      <p class="muted" style="margin-top:0;font-size:13.5px">Se muestran al cliente cuando termina su pedido y en los presupuestos.</p>
      <div class="frow"><label class="f">Alias<input name="alias" value="${OB.esc(n.alias)}"></label><label class="f">CVU / CBU<input name="cvu" value="${OB.esc(n.cvu)}"></label></div>
      <div class="frow"><label class="f">Titular<input name="titular" value="${OB.esc(n.titular)}"></label><label class="f">Seña para reservar (%)<input type="number" name="sena" min="0" max="100" value="${n.senaPct}"></label></div>
      <label class="f" style="margin-bottom:12px">Aviso en el formulario del cliente (opcional)<input name="aviso" value="${OB.esc(n.aviso)}" placeholder="Ej: Pedidos con 5 días de anticipación"></label>
      <h3 style="margin:14px 0 8px">Envío</h3><div class="frow"><label class="f">Envío gratis desde ($)<input type="number" name="gratis" min="0" value="${c.envioGratisDesde}"></label>
      ${c.zonas.map((z) => `<label class="f">${OB.esc(z.nombre)} ($)<input type="number" min="0" name="z_${z.id}" value="${z.costo}"></label>`).join('')}</div></form>`,
    `<button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" type="submit" form="aform2">Guardar</button>`);
  };
  OB.submits['ajustes-save'] = (f) => {
    const c = OB.s.config; const g = (n) => f.elements[n].value.trim();
    Object.assign(c.negocio, { alias: g('alias'), cvu: g('cvu'), titular: g('titular'), senaPct: Math.min(100, Math.max(0, +g('sena') || 0)), aviso: g('aviso') });
    c.envioGratisDesde = +g('gratis') || 0; c.zonas.forEach((z) => { z.costo = +g('z_' + z.id) || 0; });
    OB.save(); OB.closeModal(); OB.render(); OB.toast('Datos guardados');
  };
  OB.actions['reset-demo'] = () => { if (confirm('¿Restablecer todos los datos de ejemplo? Se pierden los cambios hechos en este preview.')) { OB.reset(); OB.closeModal(); OB.render(); OB.toast('Datos restablecidos'); } };

  /* alta / edición de pedidos y presupuestos (formulario compartido) */
  OB.submits['event-save'] = (f) => {
    const g = (n) => f.elements[n].value;
    const items = OB.draft.items.filter((i) => i.q > 0);
    if (!items.length) { OB.toast('Agregá al menos un producto'); return; }
    const kind = g('kind'); const id = g('id');
    const base = { cliente: g('cliente').trim(), tel: g('tel').trim(), fecha: g('fecha'), hora: g('hora'), zona: g('zona'), invitados: +g('invitados') || 0, envio: +g('envio') || 0, desc: +g('desc') || 0, notas: g('notas'), items };
    if (kind === 'pedido') {
      let p = OB.s.pedidos.find((x) => x.id === id);
      if (p) { const consumido = p.consumido; if (consumido) OB.restituir(p); Object.assign(p, base, { editadoAt: new Date().toISOString() }); if (consumido) OB.consumir(p); }
      else {
        p = { id: OB.uid(), num: OB.nextNum('pedido'), ...base, estado: 'nuevo', pagos: [], creado: OB.today(), consumido: false };
        OB.s.pedidos.push(p);
        const sena = +(f.elements.sena?.value || 0); if (sena > 0) OB.addPago(p, sena, 'Transferencia');
      }
      OB.save(); OB.closeModal(); OB.render(); OB.drawerPedido(p.id); OB.toast('Pedido guardado');
    } else {
      let q = OB.s.presupuestos.find((x) => x.id === id);
      if (q) Object.assign(q, base);
      else { q = { id: OB.uid(), num: OB.nextNum('presupuesto'), ...base, estado: 'borrador', creado: OB.today(), vence: OB.addDays(OB.today(), +g('vigencia') || 7) }; OB.s.presupuestos.push(q); }
      OB.save(); OB.closeModal(); OB.render(); OB.drawerPresu(q.id); OB.toast('Presupuesto guardado');
    }
  };

  OB.load();
  OB.render();
})();
