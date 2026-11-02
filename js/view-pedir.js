/* Formulario público de pedido (el cliente arma su pack solo): datos → pack → confirmar → comprobante.
   En producción el servidor recalcula los precios desde el catálogo; acá se hace en el navegador. */
(function () {
  const OB = window.OB;
  const { esc, money } = OB;
  const NEGOCIO_WA = '5493516233016';

  const blank = () => ({ step: 1, d: { nombre: '', tel: '', fecha: OB.addDays(OB.today(), 14), hora: '13:00', zona: 'cba', invitados: 20, notas: '' }, q: {}, principal: 'pata', opcion: 'simple', done: null, error: '' });
  OB.pub = blank();
  const fromPack = () => { const q = {}; OB.buildPack(OB.pub.d.invitados, OB.pub.principal, OB.pub.opcion).forEach((i) => { q[i.rid] = i.q; }); OB.pub.q = q; };
  const items = () => Object.entries(OB.pub.q).filter(([, n]) => n > 0).map(([rid, n]) => OB.mkItem(rid, n));
  const totals = () => { const it = items(); const sub = it.reduce((a, i) => a + i.q * i.precio, 0); const envio = OB.envioPara(OB.pub.d.zona, sub); const total = sub + envio; return { it, sub, envio, total, sena: OB.senaDe(total) }; };

  const head = (s) => `<div class="pub-head"><img src="https://obrador.ar/assets/img/logo-light.png" alt="Obrador — Comida casera"><div><h1>Armá tu pedido</h1><p>Comida artesanal para tu evento, sin complicarte. Córdoba Capital y Sierras Chicas.</p></div></div>
    <ol class="steps" aria-label="Pasos">${['Tus datos', 'Tu pack', 'Confirmar'].map((l, i) => `<li class="${s === i + 1 ? 'on' : s > i + 1 ? 'done' : ''}"><b>${i + 1}</b>${l}</li>`).join('')}</ol>`;

  const stepDatos = () => { const d = OB.pub.d; const z = OB.s.config.zonas.map((x) => `<option value="${x.id}" ${d.zona === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
    return `${OB.s.config.negocio.aviso ? `<div class="demo-note">${esc(OB.s.config.negocio.aviso)}</div>` : ''}
    <form class="card" id="pform" data-submit="pub-datos" autocomplete="off" novalidate>
      <div class="frow"><label class="f">Tu nombre<input name="nombre" value="${esc(d.nombre)}" placeholder="Nombre y apellido"></label><label class="f">WhatsApp<input name="tel" type="tel" value="${esc(d.tel)}" placeholder="351 555-0000"></label></div>
      <div class="frow"><label class="f">Fecha del evento<input type="date" name="fecha" min="${OB.addDays(OB.today(), 2)}" value="${d.fecha}"></label><label class="f">Hora de entrega<input type="time" name="hora" value="${d.hora}"></label><label class="f">Zona de entrega<select name="zona">${z}</select></label></div>
      <div class="frow"><label class="f">Cantidad de invitados<input type="number" name="invitados" min="5" max="300" value="${d.invitados}"></label></div>
      <label class="f">Comentario (opcional)<textarea name="notas" placeholder="Alergias, dirección, horario de armado…">${esc(d.notas)}</textarea></label>
      ${OB.pub.error ? `<p class="err" role="alert">${esc(OB.pub.error)}</p>` : ''}
      <div class="actions" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" type="submit">Continuar ${OB.ic('next')}</button></div></form>`; };

  const radio = (name, val, title, sub) => `<button type="button" class="opt ${OB.pub[name] === val ? 'on' : ''}" data-act="pub-opt" data-n="${name}" data-v="${val}"><b>${title}</b><span>${sub}</span></button>`;
  const stepPack = () => {
    const t = totals(); const ventas = OB.s.recetas.filter((r) => r.tipo === 'venta');
    return `<div class="card"><h2 style="margin-bottom:10px">Elegí el principal</h2><div class="opts">${radio('principal', 'pata', 'Pata fileteada', 'Cocción lenta, flambeada')}${radio('principal', 'bondiola', 'Bondiola braseada', 'Desmechada, súper jugosa')}${radio('principal', 'mix', 'Mix (ambas)', 'Mitad y mitad')}</div>
      <h2 style="margin:16px 0 10px">Simple o completa</h2><div class="opts two">${radio('opcion', 'simple', 'Opción simple', '3 pancitos de campo por persona, mayonesas caseras, salsa criolla y ensalada')}${radio('opcion', 'completa', 'Opción completa', 'Simple + picadas, hummus, pan de campo y empanaditas de copetín')}</div></div>
      <div class="card" style="margin-top:14px"><div class="card-head"><h2>Ajustá cantidades</h2><span class="muted" style="font-size:13px">Para ${OB.pub.d.invitados} invitados</span></div>
        ${ventas.map((r) => { const n = OB.pub.q[r.id] || 0; return `<div class="prod"><div><b class="strong">${esc(r.nombre)}</b><div class="muted" style="font-size:13px">${money(r.precio)} por ${r.unidad}</div></div><div class="stepper"><button type="button" data-act="pub-q" data-r="${r.id}" data-d="-1" aria-label="Menos">−</button><span class="num" aria-live="polite">${n}</span><button type="button" data-act="pub-q" data-r="${r.id}" data-d="1" aria-label="Más">+</button></div></div>`; }).join('')}</div>
      <div class="card cart" style="margin-top:14px"><h2 style="margin-bottom:8px">Tu pedido</h2>
        ${t.it.length ? t.it.map((i) => `<div class="line"><span>${i.q} × ${esc(i.nombre)}</span><span class="num">${money(i.q * i.precio)}</span></div>`).join('') : '<div class="muted">Todavía no elegiste nada.</div>'}
        <div class="line muted"><span>Envío${t.sub >= OB.s.config.envioGratisDesde ? ' (gratis desde ' + money(OB.s.config.envioGratisDesde) + ')' : ''}</span><span class="num">${t.envio ? money(t.envio) : 'Sin cargo'}</span></div>
        <div class="line big"><span>Total</span><span class="num">${money(t.total)}</span></div>
        <div class="line"><span>Seña para reservar (${OB.s.config.negocio.senaPct}%)</span><b class="num gold">${money(t.sena)}</b></div></div>
      ${OB.pub.error ? `<p class="err" role="alert">${esc(OB.pub.error)}</p>` : ''}
      <div class="bar"><div><span class="muted">Total</span> <b class="num strong">${money(t.total)}</b><span class="muted"> · seña </span><b class="num gold">${money(t.sena)}</b></div><div class="actions"><button class="btn ghost" data-act="pub-back">Volver</button><button class="btn primary" data-act="pub-revisar">Revisar y confirmar</button></div></div>`;
  };

  const resumenModal = () => {
    const t = totals(); const d = OB.pub.d;
    OB.modal('Revisá tu pedido', `<dl class="kv"><dt>Nombre</dt><dd>${esc(d.nombre)}</dd><dt>WhatsApp</dt><dd>${esc(d.tel)}</dd><dt>Evento</dt><dd>${OB.fdate(d.fecha)} · ${d.hora} · ${d.invitados} invitados</dd><dt>Zona</dt><dd>${esc(OB.s.config.zonas.find((z) => z.id === d.zona).nombre)}</dd></dl>
      <hr class="sep"><div class="items">${t.it.map((i) => `<div class="item" style="grid-template-columns:1fr auto"><span class="strong">${i.q} × ${esc(i.nombre)}</span><span class="num strong">${money(i.q * i.precio)}</span></div>`).join('')}</div>
      <div class="tot"><div><span>Envío</span><span class="num">${t.envio ? money(t.envio) : 'Sin cargo'}</span></div><div class="big"><span>Total</span><span class="num">${money(t.total)}</span></div><div><span>Seña para reservar</span><b class="num gold">${money(t.sena)}</b></div></div>`,
    `<button class="btn ghost" data-act="close">Volver a editar</button><button class="btn primary" data-act="pub-confirmar">Confirmar pedido</button>`, { noFocus: true });
  };

  const resumenTexto = (p) => { const t = OB.pTotals(p); const n = OB.s.config.negocio;
    return `*Pedido Obrador #${p.codigo}*\n${p.cliente} · ${p.tel}\nEvento: ${OB.fdate(p.fecha)} ${p.hora} · ${p.invitados} invitados\n\n${p.items.map((i) => `• ${i.q}× ${i.nombre}: ${money(i.q * i.precio)}`).join('\n')}\nEnvío: ${p.envio ? money(p.envio) : 'sin cargo'}\n*Total: ${money(t.total)}*\n*Seña para reservar: ${money(OB.senaDe(t.total))}*\n\nAlias: ${n.alias}\nCVU: ${n.cvu}\nTitular: ${n.titular}`; };

  const stepListo = () => {
    const p = OB.s.pedidos.find((x) => x.id === OB.pub.done); const t = OB.pTotals(p); const n = OB.s.config.negocio;
    return `<div class="card done"><div class="muted">Tu número de pedido</div><div class="code">#${p.codigo}</div><p style="margin:6px 0 0">¡Gracias, ${esc(p.cliente.split(' ')[0])}! Para <b class="strong">reservar la fecha</b> transferí la seña de <b class="gold num">${money(OB.senaDe(t.total))}</b> y mandanos el comprobante por WhatsApp.</p>
      <div class="bank"><div><span class="muted">Alias</span><b>${esc(n.alias)}</b><button class="btn sm" data-act="copy" data-v="${esc(n.alias)}" data-m="Alias copiado">Copiar</button></div><div><span class="muted">CVU</span><b>${esc(n.cvu)}</b><button class="btn sm" data-act="copy" data-v="${esc(n.cvu)}" data-m="CVU copiado">Copiar</button></div><div><span class="muted">Titular</span><b>${esc(n.titular)}</b></div></div></div>
      <div class="card" style="margin-top:14px"><h2 style="margin-bottom:8px">Comprobante</h2><dl class="kv"><dt>Cliente</dt><dd>${esc(p.cliente)}</dd><dt>Evento</dt><dd>${OB.fdate(p.fecha)} · ${p.hora} · ${p.invitados} invitados</dd></dl><hr class="sep">
        ${p.items.map((i) => `<div class="line"><span>${i.q} × ${esc(i.nombre)}</span><span class="num">${money(i.q * i.precio)}</span></div>`).join('')}<div class="line muted"><span>Envío</span><span class="num">${p.envio ? money(p.envio) : 'Sin cargo'}</span></div><div class="line big"><span>Total</span><span class="num">${money(t.total)}</span></div></div>
      <div class="actions" style="margin-top:14px"><button class="btn" data-act="pub-png">Descargar comprobante</button><button class="btn" data-act="copy" data-v="${esc(resumenTexto(p))}" data-m="Resumen copiado">Copiar resumen</button><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${NEGOCIO_WA}?text=${encodeURIComponent(resumenTexto(p))}">${OB.ic('wa')}Avisar por WhatsApp</a><button class="btn ghost" data-act="pub-nuevo">Hacer otro pedido</button></div>`;
  };

  OB.views.pedir = () => { const s = OB.pub; return `<div class="pub">${head(s.done ? 4 : s.step)}${s.done ? stepListo() : s.step === 1 ? stepDatos() : stepPack()}<p class="muted" style="text-align:center;font-size:12.5px;margin-top:24px">Preview — los pedidos de prueba se ven en el panel (Pedidos → “Web”).</p></div>`; };

  /* ---------- acciones ---------- */
  OB.submits['pub-datos'] = (f) => {
    const g = (n) => f.elements[n].value.trim(); const falta = [];
    if (!g('nombre')) falta.push('tu nombre'); if (g('tel').replace(/\D/g, '').length < 8) falta.push('un WhatsApp válido');
    if (!g('fecha') || g('fecha') < OB.addDays(OB.today(), 2)) falta.push('una fecha de evento (con 2 días de anticipación como mínimo)');
    if (!(+g('invitados') >= 5)) falta.push('la cantidad de invitados (mínimo 5)');
    Object.assign(OB.pub.d, { nombre: g('nombre'), tel: g('tel'), fecha: g('fecha'), hora: g('hora') || '13:00', zona: g('zona'), invitados: Math.round(+g('invitados')) || 0, notas: g('notas') });
    if (falta.length) { OB.pub.error = 'Falta completar ' + falta.join(', ') + '.'; OB.render(); const first = document.querySelector('#pform [name]'); if (first) first.focus(); return; }
    OB.pub.error = ''; OB.pub.step = 2; if (!Object.keys(OB.pub.q).length) fromPack(); OB.render(); window.scrollTo(0, 0);
  };
  OB.actions['pub-opt'] = (el) => { OB.pub[el.dataset.n] = el.dataset.v; fromPack(); OB.render(); };
  OB.actions['pub-q'] = (el) => { const r = el.dataset.r; OB.pub.q[r] = Math.max(0, Math.min(500, (OB.pub.q[r] || 0) + +el.dataset.d)); OB.render(); };
  OB.actions['pub-back'] = () => { OB.pub.step = 1; OB.pub.error = ''; OB.render(); };
  OB.actions['pub-revisar'] = () => { if (!items().length) { OB.pub.error = 'Elegí al menos un producto.'; OB.render(); return; } OB.pub.error = ''; resumenModal(); };
  OB.actions['pub-confirmar'] = () => {
    const t = totals(); const d = OB.pub.d;
    const p = { id: OB.uid(), num: OB.nextNum('pedido'), codigo: OB.codigo(), origen: 'web', cliente: d.nombre, tel: d.tel, zona: d.zona, fecha: d.fecha, hora: d.hora, invitados: d.invitados, estado: 'nuevo', items: t.it, envio: t.envio, desc: 0, pagos: [], comprobantes: [], notas: d.notas, creado: OB.today(), consumido: false };
    OB.s.pedidos.push(p); OB.save(); OB.closeModal(); OB.pub.done = p.id; OB.render(); window.scrollTo(0, 0);
  };
  OB.actions['pub-nuevo'] = () => { OB.pub = blank(); OB.render(); window.scrollTo(0, 0); };
  OB.actions['pub-png'] = () => {
    const p = OB.s.pedidos.find((x) => x.id === OB.pub.done); const t = OB.pTotals(p); const n = OB.s.config.negocio;
    const W = 760; const H = 330 + p.items.length * 34 + 190; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#1b1b1b'; x.fillRect(0, 0, W, 120);
    x.fillStyle = '#e5a823'; x.font = '700 40px Montserrat, sans-serif'; x.fillText('OBRADOR', 36, 62); x.fillStyle = '#cabeb0'; x.font = '400 18px Lato, sans-serif'; x.fillText('Comida casera para eventos · Comprobante de pedido', 36, 94);
    x.fillStyle = '#e5a823'; x.font = '700 44px Montserrat, sans-serif'; x.textAlign = 'right'; x.fillText('#' + p.codigo, W - 36, 74); x.textAlign = 'left';
    x.fillStyle = '#222'; x.font = '700 22px Lato, sans-serif'; x.fillText(p.cliente, 36, 168); x.font = '400 18px Lato, sans-serif'; x.fillStyle = '#555';
    x.fillText(`${OB.fdate(p.fecha)} · ${p.hora} · ${p.invitados} invitados · ${p.tel}`, 36, 198);
    let y = 250; x.strokeStyle = '#ddd'; x.beginPath(); x.moveTo(36, y - 24); x.lineTo(W - 36, y - 24); x.stroke();
    p.items.forEach((i) => { x.fillStyle = '#222'; x.font = '400 19px Lato, sans-serif'; x.fillText(`${i.q} × ${i.nombre}`, 36, y); x.textAlign = 'right'; x.fillText(money(i.q * i.precio), W - 36, y); x.textAlign = 'left'; y += 34; });
    x.fillStyle = '#777'; x.fillText('Envío', 36, y); x.textAlign = 'right'; x.fillText(p.envio ? money(p.envio) : 'Sin cargo', W - 36, y); x.textAlign = 'left'; y += 44;
    x.fillStyle = '#222'; x.font = '700 28px Montserrat, sans-serif'; x.fillText('Total', 36, y); x.textAlign = 'right'; x.fillText(money(t.total), W - 36, y); x.textAlign = 'left'; y += 36;
    x.fillStyle = '#b07d0c'; x.font = '700 20px Lato, sans-serif'; x.fillText('Seña para reservar: ' + money(OB.senaDe(t.total)), 36, y); y += 44;
    x.fillStyle = '#f4efe6'; x.fillRect(36, y, W - 72, 110); x.fillStyle = '#222'; x.font = '400 18px Lato, sans-serif';
    x.fillText('Alias: ' + n.alias, 56, y + 36); x.fillText('CVU: ' + n.cvu, 56, y + 66); x.fillText('Titular: ' + n.titular, 56, y + 96);
    c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `pedido-obrador-${p.codigo}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 500); });
  };
})();
