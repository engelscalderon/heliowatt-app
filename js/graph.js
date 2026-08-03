// ============================================================
// GRAPH — llamadas a Microsoft Graph para leer/escribir en OneDrive
// ============================================================
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(path, options = {}) {
  const token = await getGraphToken();
  const headers = Object.assign(
    { Authorization: `Bearer ${token}` },
    options.headers || {}
  );
  const res = await fetch(GRAPH_BASE + path, Object.assign({}, options, { headers }));
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph ${options.method || "GET"} ${path} -> ${res.status} ${body}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.arrayBuffer();
}

const ROOT = APP_CONFIG.rootFolder;

async function ensureFolders() {
  const paths = [ROOT, `${ROOT}/Cotizaciones`, `${ROOT}/Facturas`];
  for (const p of paths) {
    try {
      await graphFetch(`/me/drive/root:/${encodeURIComponent(p)}`);
    } catch (e) {
      // no existe, se crea (la ruta padre siempre existe primero en este orden)
      const parent = p.includes("/") ? p.substring(0, p.lastIndexOf("/")) : "";
      const name = p.includes("/") ? p.substring(p.lastIndexOf("/") + 1) : p;
      const parentPath = parent ? `/me/drive/root:/${encodeURIComponent(parent)}:/children` : `/me/drive/root/children`;
      await graphFetch(parentPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "replace" })
      });
    }
  }
}

async function readDb() {
  try {
    const buf = await graphFetch(`/me/drive/root:/${encodeURIComponent(ROOT + "/db.json")}:/content`);
    const text = new TextDecoder().decode(buf);
    return JSON.parse(text);
  } catch (e) {
    return null; // aún no existe
  }
}

async function writeDb(dbObj) {
  const bytes = new TextEncoder().encode(JSON.stringify(dbObj, null, 2));
  await graphFetch(`/me/drive/root:/${encodeURIComponent(ROOT + "/db.json")}:/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: bytes
  });
}

async function uploadPdf(subfolder, filename, pdfBlob) {
  const path = `${ROOT}/${subfolder}/${filename}`;
  const buf = await pdfBlob.arrayBuffer();
  await graphFetch(`/me/drive/root:/${encodeURIComponent(path)}:/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: buf
  });
  return path;
}
