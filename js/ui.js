/* Obrador Gestión — helpers de UI: íconos, modales, gráficos, editor de ítems. */
(function () {
  const OB = window.OB;
  const { esc, money } = OB;
  OB.inputs = {};

  /* ---------- íconos ---------- */
  const P = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    bag: '<path d="M5 7h14l-1 13H6L5 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    wa: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8L4 20Z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.2-1.8-1-1 .6c-.8-.4-1.4-1-1.8-1.8l.6-1-1-1.8L9 9.5Z"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  };
  OB.ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

  /* ---------- toast / modal ---------- */
  OB.toast = (msg) => {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(OB._tt);
    OB._tt = setTimeout(() => t.classList.remove('on'), 2200);
  };
  OB.modal = (title, body, foot, opts = {}) => {
    const o = document.getElementById('overlay');
    o.className = 'open' + (opts.side ? ' side-open' : '');
    o.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''} ${opts.side ? 'side' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="m-head"><h2>${esc(title)}</h2><button class="x" data-act="close" aria-label="Cerrar">${OB.ic('x')}</button></div>
      <div class="m-body">${body}</div>${foot ? `<div class="m-foot">${foot}</div>` : ''}</div>`;
    o.scrollTop = 0;
    const f = o.querySelector('input:not([type=hidden]), select');
    if (f && !opts.side && !opts.noFocus) f.focus();
  };
  OB.closeModal = () => { const o = document.getElementById('overlay'); o.className = ''; o.innerHTML = ''; OB.draft = null; OB.drawerId = null; };
  OB.actions.close = () => OB.closeModal();

  /* ---------- gráficos ---------- */
  const short = (n) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + ' k' : String(Math.round(n)));
  OB.short = short;
  OB.barChart = (labels, series) => {
    const W = 620; const H = 230; const L = 46; const B = 26; const T = 10;
    const max = Math.max(1, ...series.flatMap((s) => s.data)) * 1.08;
    const innerH = H - B - T; const gw = (W - L - 8) / labels.length; const bw = Math.min(26, (gw - 14) / series.length);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i; const y = T + innerH - (v / max) * innerH;
      g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="#2c2a27"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${short(v)}</text>`;
    }
    labels.forEach((lb, i) => {
      const x0 = L + gw * i + (gw - bw * series.length) / 2;
      series.forEach((s, k) => {
        const h = (Math.max(0, s.data[i]) / max) * innerH;
        g += `<rect x="${x0 + bw * k}" y="${T + innerH - h}" width="${bw - 3}" height="${h}" rx="3" fill="${s.color}"><title>${esc(s.name)} · ${esc(lb)}: ${money(s.data[i])}</title></rect>`;
      });
      g += `<text x="${L + gw * i + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">${g}</svg>`;
  };
  OB.legend = (series) => `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  OB.hbars = (rows) => {
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return `<div class="bars">${rows.map(([l, v, extra]) => `<div class="b"><span>${esc(l)}</span><div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div><span class="right num">${extra ?? money(v)}</span></div>`).join('')}</div>`;
  };

  /* ---------- chips ---------- */
  OB.estadoChip = (e) => `<span class="chip ${{ nuevo: 'warn', confirmado: 'info', produccion: 'warn', entregado: 'ok', cancelado: 'bad' }[e] || ''}">${OB.ESTADO_LABEL[e] || e}</span>`;
  OB.pagoChip = (t) => (t.pagado <= 0 ? '<span class="chip bad">Sin pago</span>' : t.saldo <= 0.5 ? '<span class="chip ok">Pagado</span>' : '<span class="chip warn">Seña · saldo ' + money(t.saldo) + '</span>');
  OB.waLink = (tel, text) => `https://wa.me/54${String(tel).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  /* ---------- editor de ítems (pedidos y presupuestos) ---------- */
  OB.itemsHTML = () => {
    const d = OB.draft;
    if (!d.items.length) return '<div class="empty">Sin ítems todavía. Armá el pack arriba o agregá productos.</div>';
    return d.items.map((it, i) => `<div class="item">
      <span class="strong">${esc(it.nombre)}</span>
      <input type="number" min="0" step="1" value="${it.q}" data-input="draft-q" data-i="${i}" aria-label="Cantidad">
      <span class="num muted hide-m right">${money(it.precio)}</span>
      <span class="num right strong" id="sub-${i}">${money(it.q * it.precio)}</span>
      <button type="button" class="x" data-act="draft-del" data-i="${i}" aria-label="Quitar">${OB.ic('x')}</button></div>`).join('');
  };
  OB.itemsEditor = () => {
    const opts = OB.s.recetas.filter((r) => r.tipo === 'venta').map((r) => `<option value="${r.id}">${esc(r.nombre)} — ${money(r.precio)}</option>`).join('');
    return `<div class="items" id="draft-items">${OB.itemsHTML()}</div>
      <div class="add-line"><select id="add-rid" aria-label="Producto">${opts}</select><input type="number" id="add-q" value="1" min="1" aria-label="Cantidad"><button type="button" class="btn" data-act="draft-add">${OB.ic('plus')}Agregar</button></div>
      <div class="tot" id="draft-totals"></div>`;
  };
  OB.draftTotals = () => {
    const f = document.getElementById('evform');
    if (!f || !OB.draft) return;
    const envio = +f.elements.envio.value || 0; const desc = +f.elements.desc.value || 0;
    const t = OB.pTotals({ items: OB.draft.items, envio, desc, pagos: [] });
    document.getElementById('draft-totals').innerHTML = `
      <div><span>Subtotal</span><span class="num">${money(t.sub)}</span></div>
      <div><span>Envío</span><span class="num">${money(envio)}</span></div>
      ${desc ? `<div><span>Descuento</span><span class="num">− ${money(desc)}</span></div>` : ''}
      <div class="big"><span>Total</span><span class="num">${money(t.total)}</span></div>
      <div class="muted" style="font-size:12.5px"><span>Interno: costo MP ${money(t.cmv)} · margen ${money(t.margen)} (${OB.pct(t.margenPct)})</span></div>`;
  };
  OB.refreshItems = () => { document.getElementById('draft-items').innerHTML = OB.itemsHTML(); OB.draftTotals(); };
  OB.actions['draft-add'] = () => {
    const rid = document.getElementById('add-rid').value; const q = Math.max(1, +document.getElementById('add-q').value || 1);
    const ex = OB.draft.items.find((i) => i.rid === rid);
    if (ex) ex.q += q; else OB.draft.items.push(OB.mkItem(rid, q));
    OB.refreshItems(); OB.autoEnvio();
  };
  OB.actions['draft-del'] = (el) => { OB.draft.items.splice(+el.dataset.i, 1); OB.refreshItems(); OB.autoEnvio(); };
  OB.inputs['draft-q'] = (el) => {
    const i = +el.dataset.i; OB.draft.items[i].q = Math.max(0, +el.value || 0);
    document.getElementById('sub-' + i).textContent = money(OB.draft.items[i].q * OB.draft.items[i].precio);
    OB.draftTotals();
  };
  OB.inputs.totals = () => OB.draftTotals();
  OB.autoEnvio = () => {
    const f = document.getElementById('evform'); if (!f) return;
    const sub = OB.draft.items.reduce((a, i) => a + i.q * i.precio, 0);
    f.elements.envio.value = OB.envioPara(f.elements.zona.value, sub);
    OB.draftTotals();
  };
  OB.changes['ev-zona'] = () => OB.autoEnvio();
  OB.actions['draft-pack'] = () => {
    const f = document.getElementById('evform');
    const inv = Math.max(1, +f.elements.invitados.value || 0);
    OB.draft.items = OB.buildPack(inv, f.elements.principal.value, f.elements.opcion.value);
    OB.refreshItems(); OB.autoEnvio();
    OB.toast('Pack armado para ' + inv + ' personas');
  };

  /* formulario compartido evento (pedido / presupuesto) */
  OB.eventForm = (kind, d) => {
    const z = OB.s.config.zonas.map((x) => `<option value="${x.id}" ${d.zona === x.id ? 'selected' : ''}>${esc(x.nombre)}${x.costo ? ' · ' + money(x.costo) : ''}</option>`).join('');
    return `<form id="evform" data-submit="event-save" autocomplete="off">
      <input type="hidden" name="kind" value="${kind}"><input type="hidden" name="id" value="${d.id || ''}">
      <div class="frow"><label class="f">Cliente<input name="cliente" required value="${esc(d.cliente)}" placeholder="Nombre y apellido"></label>
        <label class="f">WhatsApp<input name="tel" value="${esc(d.tel)}" placeholder="351 555-0000"></label></div>
      <div class="frow"><label class="f">Fecha del evento<input type="date" name="fecha" required value="${d.fecha}"></label>
        <label class="f">Hora de entrega<input type="time" name="hora" value="${d.hora || '13:00'}"></label>
        <label class="f">Zona<select name="zona" data-change="ev-zona">${z}</select></label></div>
      <hr class="sep"><h3 style="margin-bottom:10px">Armá el pack</h3>
      <div class="frow" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr)) auto;align-items:end">
        <label class="f">Invitados<input type="number" min="1" name="invitados" value="${d.invitados || 20}"></label>
        <label class="f">Principal<select name="principal"><option value="pata">Pata fileteada</option><option value="bondiola">Bondiola braseada</option><option value="mix">Mix (ambas)</option></select></label>
        <label class="f">Opción<select name="opcion"><option value="simple">Simple</option><option value="completa">Completa (con extras)</option></select></label>
        <button type="button" class="btn" data-act="draft-pack">Armar pack</button></div>
      ${OB.itemsEditor()}
      <div class="frow" style="margin-top:12px"><label class="f">Envío ($)<input type="number" min="0" name="envio" value="${d.envio || 0}" data-input="totals"></label>
        <label class="f">Descuento ($)<input type="number" min="0" name="desc" value="${d.desc || 0}" data-input="totals"></label>
        ${kind === 'pedido' && !d.id ? `<label class="f">Seña recibida ($)<input type="number" min="0" name="sena" value="0"></label>` : ''}
        ${kind === 'presupuesto' ? `<label class="f">Vigencia (días)<input type="number" min="1" name="vigencia" value="7"></label>` : ''}</div>
      <label class="f">Notas internas<textarea name="notas" placeholder="Alergias, horario de armado, aclaraciones…">${esc(d.notas)}</textarea></label></form>`;
  };
  OB.openEventForm = (kind, d) => {
    OB.draft = { items: JSON.parse(JSON.stringify(d.items || [])), kind };
    const title = (d.id ? 'Editar ' : 'Nuevo ') + kind;
    OB.modal(title, OB.eventForm(kind, d), `<button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" type="submit" form="evform">${d.id ? 'Guardar cambios' : kind === 'pedido' ? 'Crear pedido' : 'Crear presupuesto'}</button>`, { wide: true });
    OB.draftTotals();
  };

  /* ---------- utilidades: CSV, copiar, miniaturas ---------- */
  OB.csv = (name, rows) => {
    const cell = (v) => { const s = String(v ?? ''); return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };
  OB.copy = (text, msg) => {
    const done = () => OB.toast(msg || 'Copiado');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => OB.toast('No se pudo copiar'));
    else { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { OB.toast('No se pudo copiar'); } t.remove(); }
  };
  OB.thumb = (file) => new Promise((res) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 720 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
  OB.actions.copy = (el) => OB.copy(el.dataset.v, el.dataset.m);

  /* ---------- delegación de eventos ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el) { const fn = OB.actions[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); } return; }
    if (e.target.id === 'overlay') OB.closeModal();
  });
  document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el && OB.inputs[el.dataset.input]) OB.inputs[el.dataset.input](el, e); });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && OB.changes[el.dataset.change]) OB.changes[el.dataset.change](el, e); });
  document.addEventListener('submit', (e) => { const f = e.target.closest('[data-submit]'); if (f && OB.submits[f.dataset.submit]) { e.preventDefault(); OB.submits[f.dataset.submit](f, e); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') OB.closeModal(); });
})();
