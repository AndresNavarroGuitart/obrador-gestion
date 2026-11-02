/* Resumen: tablero del mes, próximos eventos y alertas. */
(function () {
  const OB = window.OB;
  const { esc, money } = OB;

  OB.views.resumen = () => {
    const hoy = OB.today(); const ym = OB.month(hoy); const prev = OB.shiftMonth(ym, -1);
    const pl = OB.monthPL(ym); const plPrev = OB.monthPL(prev);
    const delMes = OB.s.pedidos.filter((p) => p.estado !== 'cancelado' && OB.month(p.fecha) === ym);
    const delPrev = OB.s.pedidos.filter((p) => p.estado !== 'cancelado' && OB.month(p.fecha) === prev);
    const fact = delMes.reduce((a, p) => a + OB.pTotals(p).total, 0); const factPrev = delPrev.reduce((a, p) => a + OB.pTotals(p).total, 0);
    const d = factPrev ? fact / factPrev - 1 : 0;
    const abiertos = OB.s.pedidos.filter((p) => p.estado !== 'cancelado'); const saldoTotal = abiertos.reduce((a, p) => a + Math.max(0, OB.pTotals(p).saldo), 0);
    const saldoVenc = abiertos.filter((p) => p.estado === 'entregado').reduce((a, p) => a + Math.max(0, OB.pTotals(p).saldo), 0);
    const prox = OB.s.pedidos.filter((p) => p.fecha >= hoy && p.fecha <= OB.addDays(hoy, 10) && ['nuevo', 'confirmado', 'produccion'].includes(p.estado)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
    const meses = [5, 4, 3, 2, 1, 0].map((n) => OB.shiftMonth(ym, -n)); const hist = meses.map((m) => OB.monthPL(m));
    const series = [{ name: 'Ventas', color: '#e5a823', data: hist.map((h) => h.ventas) }, { name: 'Resultado', color: '#7cc79a', data: hist.map((h) => Math.max(0, h.resultado)) }];

    const alertas = [];
    const bajo = OB.stockBajo(); if (bajo.length) alertas.push(['bad', `<b class="strong">${bajo.length} insumos bajo el mínimo:</b> ${bajo.slice(0, 4).map((i) => esc(i.nombre)).join(', ')}${bajo.length > 4 ? '…' : ''}`, 'stock']);
    const sinSena = OB.s.pedidos.filter((p) => p.estado === 'nuevo' && p.fecha <= OB.addDays(hoy, 21)); if (sinSena.length) alertas.push(['warn', `<b class="strong">${sinSena.length} pedidos sin seña</b> con evento en las próximas 3 semanas`, 'pedidos']);
    const pend = OB.s.presupuestos.filter((q) => q.estado === 'enviado'); if (pend.length) alertas.push(['info', `<b class="strong">${pend.length} presupuestos</b> esperando respuesta (${money(pend.reduce((a, q) => a + OB.pTotals(q).total, 0))})`, 'presupuestos']);
    if (saldoVenc > 0) alertas.push(['bad', `<b class="strong">${money(saldoVenc)}</b> por cobrar de eventos ya entregados`, 'contable']);
    const bajoMargen = OB.s.recetas.filter((r) => r.tipo === 'venta' && OB.recMargen(r).netoPct < OB.s.config.margenObjetivo / 100 - 0.12);
    if (bajoMargen.length) alertas.push(['warn', `<b class="strong">${bajoMargen.map((r) => esc(r.nombre.split(' (')[0])).join(', ')}</b> con margen muy por debajo del objetivo`, 'costos']);

    const top = {}; OB.s.pedidos.filter((p) => p.estado === 'entregado' && OB.month(p.fecha) >= prev).forEach((p) => p.items.forEach((i) => { top[i.nombre.split(' (')[0]] = (top[i.nombre.split(' (')[0]] || 0) + i.q * i.precio; }));
    const topRows = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return `<div class="page-head"><div><h1>Resumen</h1><p>${OB.fmonth(ym)} · hoy es ${OB.fdate(hoy)}</p></div>
      <div class="actions"><button class="btn" data-act="presu-new-go">${OB.ic('file')}Nuevo presupuesto</button><button class="btn primary" data-act="ped-new-go">${OB.ic('plus')}Nuevo pedido</button></div></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><span class="l">Facturación del mes</span><span class="v">${money(fact)}</span><span class="s"><span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%</span> vs. ${OB.monthShort(prev)} · ${delMes.length} pedidos</span></div>
        <div class="card kpi"><span class="l">Margen bruto (entregado)</span><span class="v">${OB.pct(pl.ventas ? pl.margen / pl.ventas : 0)}</span><span class="s">${money(pl.margen)} · ${OB.monthShort(prev)}: ${OB.pct(plPrev.ventas ? plPrev.margen / plPrev.ventas : 0)}</span></div>
        <div class="card kpi"><span class="l">Resultado del mes</span><span class="v ${pl.resultado < 0 ? 'down' : 'up'}">${money(pl.resultado)}</span><span class="s">después de gastos operativos</span></div>
        <div class="card kpi"><span class="l">Por cobrar</span><span class="v">${money(saldoTotal)}</span><span class="s">${saldoVenc ? money(saldoVenc) + ' de eventos entregados' : 'sin atrasos'}</span></div></div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h2>Próximos 10 días</h2><button class="btn sm" data-act="go" data-r="pedidos">Ver tablero</button></div>
          ${prox.length ? `<div class="tbl-wrap"><table><tbody>${prox.map((p) => { const t = OB.pTotals(p); return `<tr class="click" data-act="ped-open" data-id="${p.id}"><td style="width:110px"><b class="strong">${p.fecha === hoy ? 'Hoy' : OB.fdate(p.fecha)}</b><div class="muted" style="font-size:12px">${p.hora}</div></td><td><span class="strong">${esc(p.cliente)}</span><div class="muted" style="font-size:12.5px">${p.invitados} invitados · ${OB.packLabel(p)}</div></td><td>${OB.estadoChip(p.estado)}</td><td class="r num strong">${money(t.total)}</td><td>${OB.pagoChip(t)}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No hay eventos en los próximos 10 días.</div>'}</div>
        <div class="card"><h2 style="margin-bottom:6px">Para atender</h2>${alertas.map(([c, t, r]) => `<div class="alert" style="cursor:pointer" data-act="go" data-r="${r}"><span class="dot" style="background:var(--${c === 'info' ? 'info' : c})"></span><span>${t}</span></div>`).join('') || '<div class="empty">Todo en orden.</div>'}</div></div>
      <div class="grid g2"><div class="card"><div class="card-head"><h2>Ventas y resultado</h2>${OB.legend(series)}</div>${OB.barChart(meses.map(OB.monthShort), series)}</div>
        <div class="card"><h2 style="margin-bottom:12px">Productos que más venden</h2>${topRows.length ? OB.hbars(topRows) : '<div class="empty">Sin ventas todavía.</div>'}</div></div>`;
  };

  OB.actions.go = (el) => { location.hash = '#/' + el.dataset.r; };
  OB.actions['ped-new-go'] = () => OB.actions['ped-new']();
  OB.actions['presu-new-go'] = () => OB.actions['presu-new']();
})();
