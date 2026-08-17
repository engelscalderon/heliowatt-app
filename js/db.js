// ============================================================
// DB — esquema de datos y lógica de numeración / NCF
// El "archivo" db.json vive en OneDrive y hace de base de datos.
// ============================================================

const NCF_TIPOS = [
  { prefijo: "B01", label: "Valor Fiscal" },
  { prefijo: "B02", label: "Consumo" },
  { prefijo: "B04", label: "Nota de Crédito" }
];

function ncfTipoLabel(prefijo) {
  const t = NCF_TIPOS.find(t => t.prefijo === prefijo);
  return t ? t.label : prefijo;
}

function generarRango(prefijo, inicio, cantidad, primeroUsado) {
  const out = [];
  for (let i = 0; i < cantidad; i++) {
    const num = String(inicio + i).padStart(10, "0");
    out.push({ comprobante: prefijo + num, tipo: prefijo, fechaVencimiento: null, usado: !!(primeroUsado && i === 0) });
  }
  return out;
}

function defaultDb() {
  return {
    version: 3,
    counters: {
      cotizacion: 0,
      factura: 0,
      gasto: 0
    },
    // Catálogo de clientes e items usados anteriormente, para autollenado (como una mini base de datos)
    catalog: {
      clientes: [], // {cliente, rnc, direccion, atencion, idCliente}
      items: []     // {descripcion, precio}
    },
    // Comprobantes fiscales (NCF) disponibles para usar en facturas, por tipo.
    // Precargado con un talonario inicial de 10 comprobantes por cada tipo
    // (B02 replica el talonario original de HelioWatt, con el primero ya usado).
    ncfPool: [
      ...generarRango("B01", 1, 10, false),
      ...generarRango("B02", 1, 10, true),
      ...generarRango("B04", 1, 10, false)
    ],
    cotizaciones: [], // {id, numero, fecha, cliente, rnc, atencion, direccion, trabajo, condiciones, vencimiento, items[], comentarios, subtotal, itebis, total, pdfPath}
    facturas: [],     // igual + {ncf, ncfTipo, cotizacionId}
    // Registro de gastos y compras de la empresa
    gastos: [] // {id, item, fecha, rncCedula, razonSocial, concepto, ncf, categoria, valorBruto, itbis, valorNeto}
  };
}

let DB = null; // caché en memoria de la sesión actual

async function dbLoad() {
  DB = await readDb();
  if (!DB) {
    DB = defaultDb();
    await writeDb(DB);
  }
  if (!DB.catalog) DB.catalog = { clientes: [], items: [] };

  // Migración: bases de datos creadas antes de tener tipos de comprobante (B01/B02/B04)
  let migrated = false;
  if (!DB.ncfPool) DB.ncfPool = [];
  DB.ncfPool.forEach(item => {
    if (!item.tipo) { item.tipo = item.comprobante.substring(0, 3); migrated = true; }
  });
  NCF_TIPOS.forEach(t => {
    const yaExiste = DB.ncfPool.some(x => x.tipo === t.prefijo);
    if (!yaExiste) {
      DB.ncfPool.push(...generarRango(t.prefijo, 1, 10, false));
      migrated = true;
    }
  });
  if (!DB.gastos) { DB.gastos = []; migrated = true; }
  if (!DB.counters.gasto && DB.counters.gasto !== 0) { DB.counters.gasto = DB.gastos.length; migrated = true; }
  if (migrated) await dbSave();

  return DB;
}

async function dbSave() {
  await writeDb(DB);
}

function fmtDate(d) {
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoney(n) {
  return (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nextDocNumber(tipo) {
  DB.counters[tipo] += 1;
  const n = DB.counters[tipo];
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${String(n).padStart(3, "0")}-${mm}/${yyyy}`;
}

function nextAvailableNcf(tipo) {
  const item = DB.ncfPool.find(x => x.tipo === tipo && !x.usado);
  if (!item) return null;
  return item;
}

function marcarNcfUsado(comprobante) {
  const item = DB.ncfPool.find(x => x.comprobante === comprobante);
  if (item) item.usado = true;
}

function liberarNcf(comprobante) {
  const item = DB.ncfPool.find(x => x.comprobante === comprobante);
  if (item) item.usado = false;
}

function agregarRangoNcf(tipo, inicio, cantidad) {
  DB.ncfPool.push(...generarRango(tipo, inicio, cantidad, false));
}

const DEFAULT_ITBIS_PCT = APP_CONFIG.company.itebis * 100; // 18 por defecto, editable por documento

function calcTotals(items, itbisPct) {
  const pct = (itbisPct === undefined || itbisPct === null || itbisPct === "") ? DEFAULT_ITBIS_PCT : parseFloat(itbisPct);
  const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio, 0);
  const itebis = Math.round(subtotal * (pct / 100) * 100) / 100;
  const total = Math.round((subtotal + itebis) * 100) / 100;
  return { subtotal, itebis, total, itbisPct: pct };
}

function upsertCatalog(doc) {
  if (doc.cliente) {
    const key = doc.cliente.trim().toLowerCase();
    const idx = DB.catalog.clientes.findIndex(c => c.cliente.trim().toLowerCase() === key);
    const entry = {
      cliente: doc.cliente,
      rnc: doc.rnc || "",
      direccion: doc.direccion || "",
      atencion: doc.atencion || "",
      idCliente: doc.idCliente || ""
    };
    if (idx >= 0) DB.catalog.clientes[idx] = entry;
    else DB.catalog.clientes.push(entry);
  }
  (doc.items || []).forEach(it => {
    if (!it.descripcion) return;
    const key = it.descripcion.trim().toLowerCase();
    const idx = DB.catalog.items.findIndex(x => x.descripcion.trim().toLowerCase() === key);
    const entry = { descripcion: it.descripcion, precio: it.precio };
    if (idx >= 0) DB.catalog.items[idx] = entry;
    else DB.catalog.items.push(entry);
  });
}

// ---------------- Gastos ----------------
const GASTO_CATEGORIAS = ["Compras", "Pago de Personal", "Gastos Generales"];

function addGasto(data) {
  DB.counters.gasto += 1;
  const valorBruto = data.valorBruto || 0;
  const itbisPct = (data.itbisPct === undefined || data.itbisPct === null) ? DEFAULT_ITBIS_PCT : data.itbisPct;
  const itbis = Math.round(valorBruto * (itbisPct / 100) * 100) / 100;
  const otrosImpuestosPct = data.otrosImpuestosPct || 0;
  const otrosImpuestosValor = Math.round(valorBruto * (otrosImpuestosPct / 100) * 100) / 100;
  const gasto = {
    id: crypto.randomUUID(),
    item: DB.counters.gasto,
    fecha: data.fecha,
    rncCedula: data.rncCedula || "",
    razonSocial: data.razonSocial || "",
    concepto: data.concepto || "",
    ncf: data.ncf || "",
    categoria: data.categoria || GASTO_CATEGORIAS[0],
    valorBruto,
    itbisPct,
    itbis,
    otrosImpuestosNombre: data.otrosImpuestosNombre || "",
    otrosImpuestosPct,
    otrosImpuestosValor,
    valorNeto: valorBruto + itbis + otrosImpuestosValor
  };
  DB.gastos.push(gasto);
  return gasto;
}

function deleteGasto(id) {
  const idx = DB.gastos.findIndex(g => g.id === id);
  if (idx >= 0) DB.gastos.splice(idx, 1);
}

function gastoTotals(gastos) {
  return gastos.reduce((acc, g) => {
    acc.valorBruto += g.valorBruto || 0;
    acc.itbis += g.itbis || 0;
    acc.otrosImpuestosValor += g.otrosImpuestosValor || 0;
    acc.valorNeto += g.valorNeto || 0;
    return acc;
  }, { valorBruto: 0, itbis: 0, otrosImpuestosValor: 0, valorNeto: 0 });
}
