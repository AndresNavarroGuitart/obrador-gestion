/* Módulo Contable: estado de resultados mensual, libro de movimientos y cuentas por cobrar. */
(function () {
  const OB = window.OB;
  const { esc, money } = OB;
  OB.vs.contable = { tab: 'resultados', ym: OB.month(OB.today()) };

  const tabResultados = () => {
    const ym = OB.vs.contable.ym; const pl = OB.monthPL(ym); const hoy = ym === OB.month(OB.today());
    const meses = [5, 4, 3, 2, 1, 0].map((n) => OB.shiftMonth(OB.month(OB.today()), -n));
    const hist = meses.map((m) => OB.monthPL(m));
    const series = [{ name: 'Ventas', color: '#e5a823', data: hist.map((h) => h.ventas) }, { name: 'Costos y gastos', color: '#8f867a', data: hist.map((h) => h.cmv + h.gastosOp) }];
    const cats = OB.gastosPorCat(ym).filter(([c]) => c !== 'Materia prima');
    const mbPct = pl.ventas ? pl.margen / pl.ventas : 0; const equilibrio = mbPct > 0 ? pl.gastosOp / mbPct : 0;
    return `<div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi"><span class="l">Ventas</span><span class="v">${money(pl.ventas)}</span><span class="s">${pl.n} pedidos entregados</span></div>
      <div class="card kpi"><span class="l">Margen bruto</span><span class="v">${money(pl.margen)}</span><span class="s">${OB.pct(mbPct)} de las ventas</span></div>
      <div class="card kpi"><span class="l">Resultado</span><span class="v ${pl.resultado < 0 ? 'down' : 'up'}">${money(pl.resultado)}</span><span class="s">${OB.pct(pl.ventas ? pl.resultado / pl.ventas : 0)} de las ventas</span></div>
      <div class="card kpi"><span class="l">Caja del mes</span><span class="v ${pl.caja < 0 ? 'down' : ''}">${money(pl.caja)}</span><span class="s">cobrado ${money(pl.cobros)} − pagado ${money(pl.egresos)}</span></div></div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h2>Estado de resultados</h2>${hoy ? '<span class="chip info">Mes en curso</span>' : ''}</div>
          <table><tbody>
            <tr><td class="strong">Ventas (pedidos entregados)</td><td class="r num strong">${money(pl.ventas)}</td></tr>
            <tr><td class="muted">− Costo de mercadería (según recetas)</td><td class="r num">${money(-pl.cmv)}</td></tr>
            <tr><td class="strong">= Margen bruto</td><td class="r num strong">${money(pl.margen)}</td></tr>
            ${cats.map(([c, v]) => `<tr><td class="muted">− ${c}</td><td class="r num">${money(-v)}</td></tr>`).join('')}
            <tr><td class="strong">= Resultado operativo</td><td class="r num strong ${pl.resultado < 0 ? 'down' : 'up'}">${money(pl.resultado)}</td></tr></tbody></table>
          <p class="muted" style="font-size:13px;margin:12px 0 0">Punto de equilibrio: necesitás vender <b class="strong">${money(equilibrio)}</b> por mes para cubrir los gastos operativos con el margen bruto actual. Compras de materia prima del mes (caja): ${money(pl.compras)}.</p></div>
        <div class="card"><h2 style="margin-bottom:12px">Gastos operativos</h2>${cats.length ? OB.hbars(cats) : '<div class="empty">Sin gastos cargados este mes.</div>'}</div></div>
      <div class="card"><div class="card-head"><h2>Últimos 6 meses</h2>${OB.legend(series)}</div>${OB.barChart(meses.map(OB.monthShort), series)}</div>`;
  };

  const ledger = (ym) => {
    const ing = OB.s.pedidos.filter((p) => p.estado !== 'cancelado').flatMap((p) => p.pagos.map((x) => ({ fecha: x.fecha, tipo: 'ingreso', cat: 'Ventas', desc: `Cobro ${p.num} · ${p.cliente}`, monto: x.monto, medio: x.medio }))).filter((x) => OB.month(x.fecha) === ym);
    const egr = OB.s.gastos.filter((g) => OB.month(g.fecha) === ym).map((g) => ({ ...g, tipo: 'egreso' }));
    return [...ing, ...egr].sort((a, b) => b.fecha.localeCompare(a.fecha));
  };
  const tabMovs = () => {
    const ym = OB.vs.contable.ym; const l = ledger(ym);
    const i = l.filter((x) => x.tipo === 'ingreso').reduce((a, x) => a + x.monto, 0); const e = l.filter((x) => x.tipo === 'egreso').reduce((a, x) => a + x.monto, 0);
    return `<div class="grid g3" style="margin-bottom:16px"><div class="card kpi"><span class="l">Ingresos</span><span class="v up">${money(i)}</span></div><div class="card kpi"><span class="l">Egresos</span><span class="v down">${money(e)}</span></div><div class="card kpi"><span class="l">Neto</span><span class="v">${money(i - e)}</span></div></div>
      <div class="card tbl-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Medio</th><th class="r">Monto</th><th></th></tr></thead><tbody>${l.map((x) => `<tr><td>${OB.fdate(x.fecha)}</td><td class="strong">${esc(x.desc)}</td><td><span class="chip ${x.tipo === 'ingreso' ? 'ok' : ''}">${x.cat}</span></td><td class="muted">${x.medio}</td><td class="r num ${x.tipo === 'ingreso' ? 'up' : ''}">${x.tipo === 'egreso' ? '−' : '+'} ${money(x.monto).replace('$ ', '$ ')}</td><td class="r">${x.tipo === 'egreso' ? `<button class="x" data-act="gasto-del" data-id="${x.id}" aria-label="Eliminar gasto">${OB.ic('trash')}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Sin movimientos este mes.</td></tr>'}</tbody></table></div>`;
  };

  const tabCobrar = () => {
    const hoy = OB.today();
    const list = OB.s.pedidos.filter((p) => p.estado !== 'cancelado' && OB.pTotals(p).saldo > 0.5).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const vencidos = list.filter((p) => p.estado === 'entregado'); const futuros = list.filter((p) => p.estado !== 'entregado');
    const sum = (a) => a.reduce((s, p) => s + OB.pTotals(p).saldo, 0);
    return `<div class="grid g2e" style="margin-bottom:16px"><div class="card kpi"><span class="l">Eventos ya entregados con saldo</span><span class="v ${vencidos.length ? 'down' : ''}">${money(sum(vencidos))}</span><span class="s">${vencidos.length} pedidos para reclamar</span></div><div class="card kpi"><span class="l">Saldo de eventos futuros</span><span class="v">${money(sum(futuros))}</span><span class="s">se cobra al entregar</span></div></div>
      <div class="card tbl-wrap">${list.length ? `<table><thead><tr><th>Pedido</th><th>Cliente</th><th>Evento</th><th>Estado</th><th class="r">Total</th><th class="r">Pagado</th><th class="r">Saldo</th><th></th></tr></thead><tbody>${list.map((p) => {
        const t = OB.pTotals(p); const venc = p.estado === 'entregado'; const dias = Math.round((OB.parse(hoy) - OB.parse(p.fecha)) / 864e5);
        const msg = `¡Hola ${p.cliente.split(' ')[0]}! Te escribimos de Obrador: quedó un saldo pendiente de ${money(t.saldo)} del pedido ${p.num}. Podés abonarlo por transferencia o Mercado Pago. ¡Gracias!`;
        return `<tr><td class="muted">${p.num}</td><td class="strong">${esc(p.cliente)}</td><td>${OB.fdate(p.fecha)}${venc ? ` <span class="chip bad">hace ${dias} d</span>` : ''}</td><td>${OB.estadoChip(p.estado)}</td><td class="r num">${money(t.total)}</td><td class="r num">${money(t.pagado)}</td><td class="r num strong">${money(t.saldo)}</td><td class="r" style="white-space:nowrap">${venc && p.tel ? `<a class="btn sm wa" target="_blank" rel="noopener" href="${OB.waLink(p.tel, msg)}">${OB.ic('wa')}Recordar</a> ` : ''}<button class="btn sm" data-act="ped-open" data-id="${p.id}">Cobrar</button></td></tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">No hay saldos pendientes. 🎉</div>'}</div>`;
  };

  OB.views.contable = () => {
    const v = OB.vs.contable; const body = v.tab === 'resultados' ? tabResultados() : v.tab === 'movs' ? tabMovs() : tabCobrar();
    return `<div class="page-head"><div><h1>Contable</h1><p>Ganancias, costos y caja del negocio, calculados a partir de pedidos, recetas y gastos.</p></div>
      <div class="actions"><button class="btn primary" data-act="gasto-new">${OB.ic('plus')}Registrar gasto</button></div></div>
      <div class="toolbar"><div class="tabs"><button class="${v.tab === 'resultados' ? 'on' : ''}" data-act="cont-tab" data-t="resultados">Resultados</button><button class="${v.tab === 'movs' ? 'on' : ''}" data-act="cont-tab" data-t="movs">Movimientos</button><button class="${v.tab === 'cobrar' ? 'on' : ''}" data-act="cont-tab" data-t="cobrar">Por cobrar</button></div>
        ${v.tab !== 'cobrar' ? `<div class="actions"><button class="btn sm" data-act="cont-mes" data-n="-1" aria-label="Mes anterior">${OB.ic('back')}</button><b class="strong" style="min-width:130px;text-align:center">${OB.fmonth(v.ym)}</b><button class="btn sm" data-act="cont-mes" data-n="1" aria-label="Mes siguiente">${OB.ic('next')}</button></div>` : ''}</div>
      ${body}`;
  };
  OB.actions['cont-tab'] = (el) => { OB.vs.contable.tab = el.dataset.t; OB.render(); };
  OB.actions['cont-mes'] = (el) => { const v = OB.vs.contable; const n = OB.shiftMonth(v.ym, +el.dataset.n); if (n <= OB.shiftMonth(OB.month(OB.today()), 1)) { v.ym = n; OB.render(); } };
  OB.actions['gasto-new'] = () => OB.modal('Registrar gasto', `<form id="gform" data-submit="gasto-save" autocomplete="off">
    <div class="frow"><label class="f">Fecha<input type="date" name="fecha" value="${OB.today()}" required></label><label class="f">Categoría<select name="cat">${OB.CATS_GASTO.map((c) => `<option>${c}</option>`).join('')}</select></label></div>
    <label class="f" style="margin-bottom:12px">Concepto<input name="desc" required placeholder="Ej: Reparación de la cocina"></label>
    <div class="frow"><label class="f">Monto ($)<input type="number" name="monto" min="1" required></label><label class="f">Medio<select name="medio">${OB.MEDIOS.map((m) => `<option>${m}</option>`).join('')}</select></label></div></form>`,
  `<button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" type="submit" form="gform">Guardar gasto</button>`);
  OB.submits['gasto-save'] = (f) => {
    OB.s.gastos.push({ id: OB.uid(), fecha: f.elements.fecha.value, cat: f.elements.cat.value, desc: f.elements.desc.value.trim(), monto: +f.elements.monto.value, medio: f.elements.medio.value });
    OB.vs.contable.ym = OB.month(f.elements.fecha.value); OB.save(); OB.closeModal(); OB.render(); OB.toast('Gasto registrado');
  };
  OB.actions['gasto-del'] = (el) => { if (!confirm('¿Eliminar este gasto?')) return; OB.s.gastos = OB.s.gastos.filter((g) => g.id !== el.dataset.id); OB.save(); OB.render(); };
})();
