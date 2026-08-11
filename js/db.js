// ============================================================
// DB — esquema de datos y lógica de numeración / NCF
// El "archivo" db.json vive en OneDrive y hace de base de datos.
// ============================================================

function defaultDb() {
  return {
    version: 1,
    counters: {
      cotizacion: 0,
      factura: 0
    },
    // Catálogo de clientes e items usados anteriormente, para autollenado (como una mini base de datos)
    catalog: {
      clientes: [], // {cliente, rnc, direccion, atencion, idCliente}
      items: []     // {descripcion, precio}
    },
    // Comprobantes fiscales (NCF) disponibles para usar en facturas.
    // Precargado con el talonario inicial de HelioWatt (B0200000001-B0200000010).
    ncfPool: [
      { comprobante: "B0200000001", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000002", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000003", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000004", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000005", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000006", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000007", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000008", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000009", fechaVencimiento: null, usado: false },
      { comprobante: "B0200000010", fechaVencimiento: null, usado: false }
    ],
    cotizaciones: [], // {id, numero, fecha, cliente, rnc, atencion, direccion, trabajo, condiciones, vencimiento, items[], comentarios, subtotal, itebis, total, pdfPath}
    facturas: []      // igual + {ncf, cotizacionId}
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

function nextAvailableNcf() {
  const item = DB.ncfPool.find(x => !x.usado);
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

function agregarRangoNcf(prefijo, inicio, cantidad) {
  for (let i = 0; i < cantidad; i++) {
    const num = String(inicio + i).padStart(10, "0");
    DB.ncfPool.push({ comprobante: prefijo + num, fechaVencimiento: null, usado: false });
  }
}

function calcTotals(items) {
  const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio, 0);
  const itebis = Math.round(subtotal * APP_CONFIG.company.itebis * 100) / 100;
  const total = Math.round((subtotal + itebis) * 100) / 100;
  return { subtotal, itebis, total };
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
