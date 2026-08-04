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
    const err = new Error(`Graph ${options.method || "GET"} ${path} -> ${res.status} ${body}`);
    err.status = res.status;
    throw err;
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
      continue; // ya existe, no tocar nada
    } catch (e) {
      if (e.status !== 404) throw e; // error real (permisos, red, etc.) -> no intentar crear nada, propagar
    }
    // Solo llegamos aquí si de verdad no existe (404)
    const parent = p.includes("/") ? p.substring(0, p.lastIndexOf("/")) : "";
    const name = p.includes("/") ? p.substring(p.lastIndexOf("/") + 1) : p;
    const parentPath = parent ? `/me/drive/root:/${encodeURIComponent(parent)}:/children` : `/me/drive/root/children`;
    try {
      await graphFetch(parentPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" })
      });
    } catch (e2) {
      if (e2.status !== 409) throw e2; // 409 = ya existe (carrera entre dispositivos), lo demás sí es error real
    }
  }
}

async function readDb() {
  try {
    const buf = await graphFetch(`/me/drive/root:/${encodeURIComponent(ROOT + "/db.json")}:/content`);
    const text = new TextDecoder().decode(buf);
    return JSON.parse(text);
  } catch (e) {
    if (e.status === 404) return null; // de verdad no existe todavía -> primera vez
    throw e; // cualquier otro error (permisos, red, token) NUNCA debe interpretarse como "no existe"
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

async function deleteOneDriveFile(path) {
  try {
    await graphFetch(`/me/drive/root:/${encodeURIComponent(path)}`, { method: "DELETE" });
  } catch (e) {
    console.warn("No se pudo borrar el archivo en OneDrive (puede que ya no exista):", e.message);
  }
}
