/* Obrador Gestión — estado, datos demo y lógica de negocio.
   Todo vive en localStorage: es un preview, la infra se define después. */
(function () {
  const OB = (window.OB = window.OB || {});
  OB.KEY = 'obrador-gestion-preview-v1';
  OB.vs = {}; // estado de UI por vista (filtros, tabs)
  OB.views = {};
  OB.actions = {};
  OB.changes = {};
  OB.submits = {};

  /* ---------- utilidades ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  OB.iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  OB.parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  OB.today = () => OB.iso(new Date());
  OB.addDays = (s, n) => { const d = OB.parse(s); d.setDate(d.getDate() + n); return OB.iso(d); };
  OB.month = (s) => s.slice(0, 7);
  OB.shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  OB.money = (n) => (n < -0.5 ? '−' : '') + '$ ' + Math.round(Math.abs(n)).toLocaleString('es-AR');
  OB.num = (n, d = 0) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: d });
  OB.pct = (n) => (isFinite(n) ? Math.round(n * 100) : 0) + '%';
  OB.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  OB.uid = () => 'x' + Math.random().toString(36).slice(2, 9);
  const fdate = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  OB.fdate = (s) => fdate.format(OB.parse(s)).replace(/\./g, '');
  const fmonth = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
  const fmonthShort = new Intl.DateTimeFormat('es-AR', { month: 'short' });
  OB.fmonth = (ym) => { const [y, m] = ym.split('-').map(Number); return cap(fmonth.format(new Date(y, m - 1, 1))); };
  OB.monthShort = (ym) => { const [y, m] = ym.split('-').map(Number); return cap(fmonthShort.format(new Date(y, m - 1, 1)).replace('.', '')); };
  const r3 = (n) => Math.round(n * 1000) / 1000;

  OB.ESTADOS = [
    { id: 'nuevo', label: 'Por confirmar' },
    { id: 'confirmado', label: 'Confirmado' },
    { id: 'produccion', label: 'En producción' },
    { id: 'entregado', label: 'Entregado' },
  ];
  OB.ESTADO_LABEL = { nuevo: 'Por confirmar', confirmado: 'Confirmado', produccion: 'En producción', entregado: 'Entregado', cancelado: 'Cancelado' };
  OB.CATS_GASTO = ['Materia prima', 'Sueldos', 'Alquiler', 'Gas y servicios', 'Logística', 'Marketing', 'Packaging', 'Impuestos', 'Otros'];
  OB.MEDIOS = ['Transferencia', 'Efectivo', 'Mercado Pago'];

  /* ---------- persistencia ---------- */
  OB.save = () => { try { localStorage.setItem(OB.KEY, JSON.stringify(OB.s)); return true; } catch (e) { return false; /* sin storage o sin espacio: sigue en memoria */ } };
  OB.NEGOCIO = { alias: 'alias.a.definir', cvu: '0000000000000000000000', titular: 'Titular a definir', senaPct: 50, aviso: '' };
  OB.migrate = () => { OB.s.config.negocio = Object.assign({}, OB.NEGOCIO, OB.s.config.negocio); };
  OB.load = () => {
    try { const raw = localStorage.getItem(OB.KEY); if (raw) { OB.s = JSON.parse(raw); OB.migrate(); return; } } catch (e) { /* seed */ }
    OB.s = OB.seed();
    OB.save();
  };
  OB.senaDe = (total) => Math.round((total * OB.s.config.negocio.senaPct) / 100 / 500) * 500;
  OB.codigo = () => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c;
    do { c = Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); } while (OB.s.pedidos.some((p) => p.codigo === c));
    return c;
  };
  OB.reset = () => { try { localStorage.removeItem(OB.KEY); } catch (e) { /* noop */ } OB.s = OB.seed(); OB.save(); };

  /* ---------- recetas y costos ---------- */
  OB.rec = (id) => OB.s.recetas.find((r) => r.id === id);
  OB.ins = (id) => OB.s.insumos.find((i) => i.id === id);
  OB.costRec = (id, depth = 0) => {
    const r = OB.rec(id);
    if (!r || depth > 5) return 0;
    return r.lineas.reduce((a, l) => a + (l.t === 'i' ? (OB.ins(l.id)?.costo || 0) * l.q : OB.costRec(l.id, depth + 1) * l.q), 0);
  };
  OB.recMargen = (r) => {
    const costo = OB.costRec(r.id);
    const ind = costo * (OB.s.config.indirectosPct / 100);
    return { costo, bruto: r.precio - costo, brutoPct: r.precio ? (r.precio - costo) / r.precio : 0, neto: r.precio - costo - ind, netoPct: r.precio ? (r.precio - costo - ind) / r.precio : 0, sugerido: costo * (1 + OB.s.config.indirectosPct / 100) / (1 - OB.s.config.margenObjetivo / 100) };
  };
  const explodeLines = (lineas, mult, acc) => {
    lineas.forEach((l) => {
      if (l.t === 'i') acc.set(l.id, (acc.get(l.id) || 0) + l.q * mult);
      else { const r = OB.rec(l.id); if (r) explodeLines(r.lineas, mult * l.q, acc); }
    });
  };
  OB.needs = (items) => {
    const acc = new Map();
    items.forEach((it) => { const r = OB.rec(it.rid); if (r) explodeLines(r.lineas, it.q, acc); });
    return acc;
  };

  /* ---------- pedidos / presupuestos ---------- */
  OB.pTotals = (p) => {
    const sub = p.items.reduce((a, i) => a + i.q * i.precio, 0);
    const total = Math.max(0, sub + (+p.envio || 0) - (+p.desc || 0));
    const cmv = p.items.reduce((a, i) => a + i.q * i.costo, 0);
    const pagado = (p.pagos || []).reduce((a, x) => a + x.monto, 0);
    return { sub, total, cmv, pagado, saldo: total - pagado, margen: total - cmv, margenPct: total ? (total - cmv) / total : 0 };
  };
  OB.mkItem = (rid, q) => { const r = OB.rec(rid); return { rid, nombre: r.nombre, q, precio: r.precio, costo: OB.costRec(rid) }; };
  OB.nextNum = (kind) => { OB.s.seq[kind] += 1; return (kind === 'pedido' ? 'P-' : 'Q-') + String(OB.s.seq[kind]).padStart(4, '0'); };

  OB.buildPack = (inv, principal, opcion) => {
    const items = [];
    if (principal === 'pata') items.push(['v_pata', inv]);
    else if (principal === 'bondiola') items.push(['v_bondiola', inv]);
    else { items.push(['v_pata', Math.ceil(inv / 2)]); if (Math.floor(inv / 2) > 0) items.push(['v_bondiola', Math.floor(inv / 2)]); }
    if (opcion === 'completa') {
      [['v_picada', 5], ['v_hummus', 1], ['v_pan', 3], ['v_empa', 3]].forEach(([rid, n]) => items.push([rid, Math.max(1, Math.round((n * inv) / 10))]));
    }
    return items.map(([rid, q]) => OB.mkItem(rid, q));
  };
  OB.envioPara = (zonaId, subtotal) => {
    const z = OB.s.config.zonas.find((x) => x.id === zonaId);
    if (!z) return 0;
    return subtotal >= OB.s.config.envioGratisDesde ? 0 : z.costo;
  };

  OB.consumir = (p) => {
    OB.needs(p.items).forEach((q, id) => {
      const i = OB.ins(id);
      if (!i) return;
      i.stock = r3(i.stock - q);
      OB.s.movStock.push({ id: OB.uid(), fecha: OB.today(), insumoId: id, tipo: 'consumo', cant: -r3(q), ref: p.num, nota: 'Producción ' + p.cliente });
    });
    p.consumido = true;
  };
  OB.restituir = (p) => {
    OB.needs(p.items).forEach((q, id) => {
      const i = OB.ins(id);
      if (!i) return;
      i.stock = r3(i.stock + q);
      OB.s.movStock.push({ id: OB.uid(), fecha: OB.today(), insumoId: id, tipo: 'ajuste', cant: r3(q), ref: p.num, nota: 'Reversión ' + p.cliente });
    });
    p.consumido = false;
  };
  OB.setEstado = (p, est) => {
    const idx = OB.ESTADOS.findIndex((e) => e.id === est);
    p.estado = est;
    if (est === 'entregado') p.entregadoAt = new Date().toISOString(); else if (idx >= 0) delete p.entregadoAt;
    if (idx >= 2 && !p.consumido) OB.consumir(p);
    else if (idx >= 0 && idx < 2 && p.consumido) OB.restituir(p);
  };
  OB.addPago = (p, monto, medio, fecha) => {
    p.pagos.push({ id: OB.uid(), fecha: fecha || OB.today(), monto: +monto, medio: medio || 'Transferencia' });
    if (p.estado === 'nuevo') OB.setEstado(p, 'confirmado');
  };
  OB.aceptarPresupuesto = (q) => {
    const p = {
      id: OB.uid(), num: OB.nextNum('pedido'), cliente: q.cliente, tel: q.tel, zona: q.zona, fecha: q.fecha, hora: q.hora || '13:00',
      invitados: q.invitados, estado: 'nuevo', items: JSON.parse(JSON.stringify(q.items)), envio: q.envio, desc: q.desc, pagos: [], notas: q.notas || '',
      creado: OB.today(), consumido: false, presupuesto: q.num,
    };
    OB.s.pedidos.push(p);
    q.estado = 'aceptado';
    q.pedidoId = p.id;
    return p;
  };
  OB.registrarCompra = ({ insumoId, cant, costoTotal, proveedor, fecha }) => {
    const i = OB.ins(insumoId);
    i.stock = r3(i.stock + cant);
    i.costoAnt = i.costo;
    i.costo = Math.round(costoTotal / cant);
    OB.s.movStock.push({ id: OB.uid(), fecha, insumoId, tipo: 'ingreso', cant, costoTotal, ref: proveedor || '', nota: 'Compra' });
    OB.s.gastos.push({ id: OB.uid(), fecha, cat: 'Materia prima', desc: `Compra ${i.nombre}${proveedor ? ' · ' + proveedor : ''}`, monto: costoTotal, medio: 'Transferencia' });
  };

  /* ---------- finanzas ---------- */
  OB.monthPL = (ym) => {
    const ped = OB.s.pedidos.filter((p) => p.estado === 'entregado' && OB.month(p.fecha) === ym);
    let ventas = 0; let cmv = 0;
    ped.forEach((p) => { const t = OB.pTotals(p); ventas += t.total; cmv += t.cmv; });
    const gm = OB.s.gastos.filter((g) => OB.month(g.fecha) === ym);
    const gastosOp = gm.filter((g) => g.cat !== 'Materia prima').reduce((a, g) => a + g.monto, 0);
    const compras = gm.filter((g) => g.cat === 'Materia prima').reduce((a, g) => a + g.monto, 0);
    const egresos = gm.reduce((a, g) => a + g.monto, 0);
    const cobros = OB.s.pedidos.filter((p) => p.estado !== 'cancelado').flatMap((p) => p.pagos).filter((x) => OB.month(x.fecha) === ym).reduce((a, x) => a + x.monto, 0);
    return { ym, n: ped.length, ventas, cmv, margen: ventas - cmv, gastosOp, resultado: ventas - cmv - gastosOp, compras, egresos, cobros, caja: cobros - egresos };
  };
  OB.gastosPorCat = (ym) => {
    const m = {};
    OB.s.gastos.filter((g) => OB.month(g.fecha) === ym).forEach((g) => { m[g.cat] = (m[g.cat] || 0) + g.monto; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  OB.stockBajo = () => OB.s.insumos.filter((i) => i.stock <= i.minimo);

  /* ---------- datos demo ---------- */
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  OB.seed = () => {
    const rnd = mulberry32(2610);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const today = OB.today();
    const thisMonth = OB.month(today);

    const insumos = [
      ['i_pata', 'Pata de cerdo', 'kg', 'Carnes', 6800, 6300, 38, 20, 'Frigorífico Sierras'],
      ['i_bondiola', 'Bondiola de cerdo', 'kg', 'Carnes', 9500, 8700, 22, 15, 'Frigorífico Sierras'],
      ['i_carnepicada', 'Carne picada', 'kg', 'Carnes', 8500, 7900, 12, 8, 'Carnicería Don Pedro'],
      ['i_harina', 'Harina 000', 'kg', 'Almacén', 1100, 1050, 60, 40, 'Distribuidora Centro'],
      ['i_levadura', 'Levadura fresca', 'kg', 'Almacén', 4500, 4500, 3, 2, 'Distribuidora Centro'],
      ['i_aceite', 'Aceite de girasol', 'L', 'Almacén', 2200, 2000, 30, 15, 'Distribuidora Centro'],
      ['i_oliva', 'Aceite de oliva', 'L', 'Almacén', 11000, 10200, 6, 5, 'Distribuidora Centro'],
      ['i_tahini', 'Tahini', 'kg', 'Almacén', 12000, 11000, 1.2, 1, 'Dietética Natural'],
      ['i_garbanzos', 'Garbanzos', 'kg', 'Almacén', 3000, 2800, 10, 5, 'Dietética Natural'],
      ['i_huevos', 'Huevos', 'u', 'Verdulería', 250, 230, 90, 60, 'Granja La Esperanza'],
      ['i_cebolla', 'Cebolla', 'kg', 'Verdulería', 1200, 1300, 14, 10, 'Verdulería Mercado'],
      ['i_tomate', 'Tomate', 'kg', 'Verdulería', 2800, 2400, 9, 12, 'Verdulería Mercado'],
      ['i_lechuga', 'Lechuga', 'kg', 'Verdulería', 2500, 2500, 6, 5, 'Verdulería Mercado'],
      ['i_morron', 'Morrón', 'kg', 'Verdulería', 3500, 3300, 4, 3, 'Verdulería Mercado'],
      ['i_verdeo', 'Cebolla de verdeo', 'atado', 'Verdulería', 1000, 900, 12, 8, 'Verdulería Mercado'],
      ['i_jamon', 'Jamón cocido', 'kg', 'Fiambres', 14000, 13200, 5, 4, 'Fiambrería Italiana'],
      ['i_salame', 'Salame', 'kg', 'Fiambres', 16000, 15000, 3, 3, 'Fiambrería Italiana'],
      ['i_queso', 'Queso pategrás', 'kg', 'Fiambres', 10500, 10000, 6, 4, 'Fiambrería Italiana'],
      ['i_tapas', 'Tapas de empanadita copetín', 'u', 'Almacén', 90, 80, 180, 120, 'Fábrica de Pastas'],
      ['i_bandeja', 'Bandeja descartable', 'u', 'Packaging', 450, 400, 120, 80, 'Packaging Córdoba'],
    ].map(([id, nombre, unidad, cat, costo, costoAnt, stock, minimo, proveedor]) => ({ id, nombre, unidad, cat, costo, costoAnt, stock, minimo, proveedor }));

    const recetas = [
      { id: 'r_pan', nombre: 'Pancitos de campo x3 (75 g)', tipo: 'base', unidad: 'persona', precio: 0, lineas: [{ t: 'i', id: 'i_harina', q: 0.16 }, { t: 'i', id: 'i_levadura', q: 0.004 }, { t: 'i', id: 'i_aceite', q: 0.01 }] },
      { id: 'r_salsas', nombre: 'Mayonesas, criolla y ensalada', tipo: 'base', unidad: 'persona', precio: 0, lineas: [{ t: 'i', id: 'i_huevos', q: 0.15 }, { t: 'i', id: 'i_aceite', q: 0.035 }, { t: 'i', id: 'i_cebolla', q: 0.03 }, { t: 'i', id: 'i_tomate', q: 0.08 }, { t: 'i', id: 'i_lechuga', q: 0.04 }, { t: 'i', id: 'i_morron', q: 0.02 }, { t: 'i', id: 'i_verdeo', q: 0.02 }] },
      { id: 'v_pata', nombre: 'Pata fileteada (pack por persona)', tipo: 'venta', unidad: 'persona', precio: 6500, lineas: [{ t: 'i', id: 'i_pata', q: 0.33 }, { t: 'r', id: 'r_pan', q: 1 }, { t: 'r', id: 'r_salsas', q: 1 }, { t: 'i', id: 'i_bandeja', q: 0.1 }] },
      { id: 'v_bondiola', nombre: 'Bondiola braseada (pack por persona)', tipo: 'venta', unidad: 'persona', precio: 6500, lineas: [{ t: 'i', id: 'i_bondiola', q: 0.3 }, { t: 'r', id: 'r_pan', q: 1 }, { t: 'r', id: 'r_salsas', q: 1 }, { t: 'i', id: 'i_bandeja', q: 0.1 }] },
      { id: 'v_picada', nombre: 'Picada / tabla de fiambres', tipo: 'venta', unidad: 'tabla', precio: 5000, lineas: [{ t: 'i', id: 'i_jamon', q: 0.05 }, { t: 'i', id: 'i_salame', q: 0.04 }, { t: 'i', id: 'i_queso', q: 0.06 }, { t: 'i', id: 'i_bandeja', q: 1 }] },
      { id: 'v_hummus', nombre: 'Hummus casero', tipo: 'venta', unidad: 'pote', precio: 3500, lineas: [{ t: 'i', id: 'i_garbanzos', q: 0.15 }, { t: 'i', id: 'i_tahini', q: 0.02 }, { t: 'i', id: 'i_oliva', q: 0.03 }, { t: 'i', id: 'i_bandeja', q: 0.5 }] },
      { id: 'v_pan', nombre: 'Pan de campo / Focaccia 500 g', tipo: 'venta', unidad: 'unidad', precio: 3500, lineas: [{ t: 'i', id: 'i_harina', q: 0.35 }, { t: 'i', id: 'i_levadura', q: 0.008 }, { t: 'i', id: 'i_oliva', q: 0.03 }] },
      { id: 'v_empa', nombre: 'Empanaditas de copetín (docena)', tipo: 'venta', unidad: 'docena', precio: 6000, lineas: [{ t: 'i', id: 'i_carnepicada', q: 0.22 }, { t: 'i', id: 'i_cebolla', q: 0.1 }, { t: 'i', id: 'i_tapas', q: 12 }, { t: 'i', id: 'i_aceite', q: 0.1 }] },
    ];

    OB.s = {
      v: 1,
      config: {
        negocio: { ...OB.NEGOCIO },
        indirectosPct: 18, margenObjetivo: 55, envioGratisDesde: 100000,
        zonas: [{ id: 'cba', nombre: 'Córdoba Capital', costo: 7000 }, { id: 'sierras', nombre: 'Sierras Chicas', costo: 12000 }, { id: 'retira', nombre: 'Retira en local', costo: 0 }],
      },
      insumos, recetas, movStock: [], pedidos: [], presupuestos: [], gastos: [], seq: { pedido: 0, presupuesto: 0 },
    };

    const nombres = ['Lucía Fernández', 'Martín Gómez', 'Carolina Ruiz', 'Federico Sosa', 'Valentina Paz', 'Julián Herrera', 'Agustina Molina', 'Nicolás Castro', 'Camila Ortiz', 'Matías Romero', 'Florencia Díaz', 'Sebastián Acosta', 'Rocío Benítez', 'Tomás Medina', 'Paula Aguirre', 'Gonzalo Vega', 'Mariana Luna', 'Ignacio Ríos', 'Sofía Navarro', 'Diego Cabrera', 'Empresa Altavista SRL', 'Estudio Torres & Asoc.', 'Club Social Unión', 'Colegio San Martín'];
    const horas = ['12:30', '13:00', '13:30', '20:00', '20:30', '21:00'];
    const invOpts = [20, 20, 25, 30, 30, 35, 40, 40, 50, 50, 60, 70, 80, 100];
    const zonaIds = ['cba', 'cba', 'cba', 'sierras', 'retira'];
    let phone = 100;

    const mkPedido = (fecha, estado, factor) => {
      const inv = pick(invOpts);
      const principal = pick(['pata', 'pata', 'bondiola', 'mix']);
      const opcion = rnd() < 0.5 ? 'completa' : 'simple';
      const items = OB.buildPack(inv, principal, opcion).map((it) => ({ ...it, precio: Math.round(it.precio * factor.precio / 50) * 50, costo: Math.round(it.costo * factor.costo) }));
      const sub = items.reduce((a, i) => a + i.q * i.precio, 0);
      const zona = pick(zonaIds);
      const p = {
        id: OB.uid(), num: OB.nextNum('pedido'), cliente: pick(nombres), tel: `351 555-${String(phone++).padStart(4, '0')}`, zona,
        fecha, hora: pick(horas), invitados: inv, estado, items, envio: OB.envioPara(zona, sub), desc: rnd() < 0.12 ? Math.round(sub * 0.05 / 500) * 500 : 0,
        pagos: [], notas: '', creado: OB.addDays(fecha, -Math.floor(8 + rnd() * 14)), consumido: false,
      };
      return p;
    };
    const pagar = (p, pendiente) => {
      const t = OB.pTotals(p).total;
      const sena = Math.round((t * 0.5) / 500) * 500;
      p.pagos.push({ id: OB.uid(), fecha: OB.addDays(p.fecha, -7), monto: sena, medio: pick(['Transferencia', 'Transferencia', 'Mercado Pago']) });
      if (!pendiente) p.pagos.push({ id: OB.uid(), fecha: p.fecha, monto: t - sena, medio: pick(OB.MEDIOS) });
    };

    // meses pasados + actual (entregados)
    for (let m = 5; m >= 0; m--) {
      const ym = OB.shiftMonth(thisMonth, -m);
      const [y, mo] = ym.split('-').map(Number);
      const lastDay = m === 0 ? Math.max(1, +today.slice(8) - 1) : new Date(y, mo, 0).getDate();
      const n = m === 0 ? 8 : 7 + (5 - m) + Math.floor(rnd() * 3);
      const factor = { precio: 1 - 0.02 * m, costo: 1 - 0.03 * m };
      for (let k = 0; k < n; k++) {
        let day; let tries = 0;
        do { day = 1 + Math.floor(rnd() * lastDay); tries++; const dow = new Date(y, mo - 1, day).getDay(); if (dow === 0 || dow === 5 || dow === 6 || tries > 4) break; } while (true);
        const fecha = `${ym}-${pad(day)}`;
        if (fecha >= today) continue;
        const p = mkPedido(fecha, 'entregado', factor);
        pagar(p, m <= 1 && rnd() < 0.15);
        OB.s.pedidos.push(p);
      }
    }
    // próximos eventos
    [[1, 'produccion'], [3, 'confirmado'], [5, 'confirmado'], [8, 'confirmado'], [12, 'confirmado'], [15, 'nuevo'], [19, 'nuevo'], [26, 'nuevo']].forEach(([off, estado]) => {
      const p = mkPedido(OB.addDays(today, off), estado, { precio: 1, costo: 1 });
      if (estado !== 'nuevo') pagar(p, true);
      p.consumido = false;
      OB.s.pedidos.push(p);
      if (estado === 'produccion') OB.consumir(p);
    });
    const canc = mkPedido(OB.addDays(today, 9), 'cancelado', { precio: 1, costo: 1 });
    canc.notas = 'Canceló por cambio de fecha del evento';
    OB.s.pedidos.push(canc);
    OB.s.pedidos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    OB.s.pedidos.forEach((p) => {
      p.codigo = OB.codigo();
      if (rnd() < 0.4) p.origen = 'web';
      p.comprobantes = [];
      if (['confirmado', 'produccion'].includes(p.estado)) p.comprobantes.push({ id: OB.uid(), name: 'transferencia-sena.pdf', type: 'application/pdf', size: 84000 + Math.floor(rnd() * 60000), at: OB.addDays(today, -Math.floor(rnd() * 5)) + 'T15:00:00.000Z', thumb: null });
    });
    const editado = OB.s.pedidos.find((p) => p.estado === 'confirmado'); if (editado) editado.editadoAt = OB.addDays(today, -2) + 'T10:00:00.000Z';

    // presupuestos
    const mkQ = (offsetCreado, estado, offEvento) => {
      const inv = pick(invOpts); const principal = pick(['pata', 'bondiola', 'mix']); const opcion = rnd() < 0.5 ? 'completa' : 'simple';
      const items = OB.buildPack(inv, principal, opcion); const sub = items.reduce((a, i) => a + i.q * i.precio, 0); const zona = pick(zonaIds);
      const creado = OB.addDays(today, offsetCreado);
      return { id: OB.uid(), num: OB.nextNum('presupuesto'), cliente: pick(nombres), tel: `351 555-${String(phone++).padStart(4, '0')}`, zona, fecha: OB.addDays(today, offEvento), hora: '13:00', invitados: inv, estado, items, envio: OB.envioPara(zona, sub), desc: 0, creado, vence: OB.addDays(creado, 7), notas: '' };
    };
    [[-1, 'enviado', 20], [-2, 'enviado', 33], [-5, 'enviado', 24], [0, 'borrador', 40], [-9, 'rechazado', 18], [-12, 'vencido', 14], [-16, 'rechazado', 25], [-18, 'vencido', 12]].forEach(([c, e, ev]) => OB.s.presupuestos.push(mkQ(c, e, ev)));
    OB.s.presupuestos.forEach((q) => { if (q.estado === 'vencido') q.vence = OB.addDays(q.creado, 7); });
    // presupuestos aceptados que ya son pedidos
    OB.s.pedidos.filter((p) => !['entregado', 'cancelado'].includes(p.estado)).slice(0, 4).forEach((p) => {
      const q = { id: OB.uid(), num: OB.nextNum('presupuesto'), cliente: p.cliente, tel: p.tel, zona: p.zona, fecha: p.fecha, hora: p.hora, invitados: p.invitados, estado: 'aceptado', items: JSON.parse(JSON.stringify(p.items)), envio: p.envio, desc: p.desc, creado: p.creado, vence: OB.addDays(p.creado, 7), notas: '', pedidoId: p.id };
      OB.s.presupuestos.push(q); p.presupuesto = q.num;
    });

    // movimientos de stock históricos (compras y consumos), sin alterar los stocks actuales
    [3, 5, 8, 10, 12, 15, 17, 20, 24, 28, 33, 38].forEach((d, k) => {
      const i = OB.s.insumos[(k * 5 + 1) % OB.s.insumos.length];
      const cant = i.unidad === 'u' ? 60 + Math.floor(rnd() * 140) : i.unidad === 'atado' ? 10 : 8 + Math.floor(rnd() * 22);
      OB.s.movStock.push({ id: OB.uid(), fecha: OB.addDays(today, -d), insumoId: i.id, tipo: 'ingreso', cant, costoTotal: Math.round((cant * i.costoAnt) / 100) * 100, ref: i.proveedor, nota: 'Compra' });
    });
    OB.s.pedidos.filter((p) => p.estado === 'entregado' && p.fecha >= OB.addDays(today, -21)).forEach((p) => {
      OB.needs(p.items).forEach((q, id) => OB.s.movStock.push({ id: OB.uid(), fecha: p.fecha, insumoId: id, tipo: 'consumo', cant: -Math.round(q * 1000) / 1000, ref: p.num, nota: 'Producción ' + p.cliente }));
    });
    OB.s.movStock.sort((a, b) => a.fecha.localeCompare(b.fecha));
    OB.s.gastos.push({ id: OB.uid(), fecha: OB.addDays(today, -9), cat: 'Otros', desc: 'Reparación del horno', monto: 85000, medio: 'Efectivo' }, { id: OB.uid(), fecha: OB.addDays(today, -20), cat: 'Packaging', desc: 'Etiquetas con logo', monto: 42000, medio: 'Mercado Pago' });

    // gastos mensuales
    const dias = [5, 8, 10, 12, 14, 18, 20];
    for (let m = 5; m >= 0; m--) {
      const ym = OB.shiftMonth(thisMonth, -m);
      const cmv = OB.s.pedidos.filter((p) => p.estado === 'entregado' && OB.month(p.fecha) === ym).reduce((a, p) => a + OB.pTotals(p).cmv, 0);
      const ventas = OB.s.pedidos.filter((p) => p.estado === 'entregado' && OB.month(p.fecha) === ym).reduce((a, p) => a + OB.pTotals(p).total, 0);
      const filas = [
        ['Materia prima', 'Compras del mes (verdulería, carnes, almacén)', Math.round((cmv * 1.04) / 1000) * 1000, dias[0]],
        ['Sueldos', 'Ayudantes de cocina y reparto', 420000 + (5 - m) * 15000, 5],
        ['Alquiler', 'Alquiler de cocina', 180000, 10],
        ['Gas y servicios', 'Gas, luz y agua', 62000 + Math.round(rnd() * 8000), 12],
        ['Logística', 'Combustible y mantenimiento utilitario', 44000 + Math.round(rnd() * 12000), 14],
        ['Marketing', 'Pauta en Instagram / Google', 30000 + Math.round(rnd() * 10000), 16],
        ['Packaging', 'Bandejas, bolsas y etiquetas', 28000 + Math.round(rnd() * 6000), 18],
        ['Impuestos', 'Monotributo / ingresos brutos', Math.round((ventas * 0.04) / 1000) * 1000, 20],
      ];
      filas.forEach(([cat, desc, monto, dia]) => {
        const fecha = `${ym}-${pad(dia)}`;
        if (fecha > today || monto <= 0) return;
        OB.s.gastos.push({ id: OB.uid(), fecha, cat, desc, monto, medio: cat === 'Alquiler' || cat === 'Sueldos' ? 'Transferencia' : pick(OB.MEDIOS) });
      });
    }
    OB.s.gastos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return OB.s;
  };
})();
