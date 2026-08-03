// ============================================================
// APP — navegación, formularios y flujo de guardado
// ============================================================
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function showLoading(text) {
  $("#loadingText").textContent = text || "Cargando…";
  $("#loadingOverlay").classList.remove("hidden");
}
function hideLoading() { $("#loadingOverlay").classList.add("hidden"); }

function toast(msg, isError) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.toggle("error", !!isError);
  setTimeout(() => t.classList.add("hidden"), 3500);
}

function showView(name) {
  $all(".view").forEach(v => v.classList.add("hidden"));
  $(`#view-${name}`).classList.remove("hidden");
  $all(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  if (name === "dashboard") renderDashboard();
  if (name === "cotizacion") renderForm("cotForm", "cotizacion");
  if (name === "factura") { renderFacturaSelect(); renderForm("facForm", "factura"); }
  if (name === "historial") renderHistorial();
  if (name === "ncf") renderNcf();
}

// ---------------- Formularios de documento ----------------
function itemRowHtml(idx) {
  return `
  <div class="item-row" data-idx="${idx}">
    <input type="number" class="it-cant" placeholder="Cant." step="0.01" value="1" required>
    <input type="text" class="it-desc" placeholder="Descripción" required>
    <input type="number" class="it-precio" placeholder="Precio unit." step="0.01" required>
    <button type="button" class="btn-remove-item">✕</button>
  </div>`;
}

function renderForm(formId, tipo) {
  const form = $(`#${formId}`);
  form.innerHTML = `
    <div class="field-grid">
      <div class="field"><label>Cliente</label><input name="cliente" required></div>
      <div class="field"><label>RNC / Cédula del cliente</label><input name="rnc"></div>
      <div class="field"><label>Dirección del cliente</label><input name="direccion"></div>
      <div class="field"><label>Atención (contacto)</label><input name="atencion"></div>
      <div class="field"><label>ID del cliente</label><input name="idCliente"></div>
      <div class="field"><label>Trabajo / servicio</label><input name="trabajo" required></div>
      <div class="field"><label>Condiciones de pago</label><input name="condiciones" value="Pago 100% contra trabajo"></div>
      <div class="field"><label>Fecha de vencimiento</label><input name="vencimiento" placeholder="ej. 26-ago.-26"></div>
    </div>

    <h3>Renglones</h3>
    <div id="${formId}-items">${itemRowHtml(0)}</div>
    <button type="button" class="btn btn-outline" id="${formId}-addItem">+ Agregar renglón</button>

    <div class="field">
      <label>Comentarios</label>
      <textarea name="comentarios" rows="2"></textarea>
    </div>

    <div class="totals-preview" id="${formId}-totals">Subtotal: $0.00 · ITEBIS: $0.00 · Total: $0.00</div>

    <button type="submit" class="btn btn-primary">${tipo === "factura" ? "Generar factura" : "Generar cotización"}</button>
  `;

  const itemsWrap = $(`#${formId}-items`);
  $(`#${formId}-addItem`).onclick = () => {
    const idx = itemsWrap.children.length;
    itemsWrap.insertAdjacentHTML("beforeend", itemRowHtml(idx));
    wireItemRow(itemsWrap.lastElementChild, formId);
  };
  wireItemRow(itemsWrap.firstElementChild, formId);

  form.onsubmit = (e) => { e.preventDefault(); submitDoc(formId, tipo, form); };
}

function wireItemRow(row, formId) {
  row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => updateTotalsPreview(formId)));
  row.querySelector(".btn-remove-item").onclick = () => {
    if ($(`#${formId}-items`).children.length > 1) { row.remove(); updateTotalsPreview(formId); }
  };
}

function readItems(formId) {
  return $all(`#${formId}-items .item-row`).map(r => ({
    cantidad: parseFloat(r.querySelector(".it-cant").value) || 0,
    descripcion: r.querySelector(".it-desc").value,
    precio: parseFloat(r.querySelector(".it-precio").value) || 0
  })).filter(it => it.descripcion);
}

function updateTotalsPreview(formId) {
  const items = readItems(formId);
  const t = calcTotals(items);
  $(`#${formId}-totals`).textContent =
    `Subtotal: $${t.subtotal.toFixed(2)} · ITEBIS: $${t.itebis.toFixed(2)} · Total: $${t.total.toFixed(2)}`;
}

function renderFacturaSelect() {
  const sel = $("#facturaFromCot");
  sel.innerHTML = `<option value="">— Factura directa (sin cotización) —</option>` +
    DB.cotizaciones.slice().reverse().map(c => `<option value="${c.id}">${c.numero} — ${c.cliente}</option>`).join("");
  sel.onchange = () => {
    const cot = DB.cotizaciones.find(c => c.id === sel.value);
    const form = $("#facForm");
    if (!cot) return;
    form.cliente.value = cot.cliente;
    form.rnc.value = cot.rnc || "";
    form.direccion.value = cot.direccion || "";
    form.atencion.value = cot.atencion || "";
    form.idCliente.value = cot.idCliente || "";
    form.trabajo.value = cot.trabajo;
    form.condiciones.value = cot.condiciones;
    form.comentarios.value = cot.comentarios || "";
    const wrap = $("#facForm-items");
    wrap.innerHTML = cot.items.map((it, i) => itemRowHtml(i)).join("");
    $all("#facForm-items .item-row").forEach((row, i) => {
      row.querySelector(".it-cant").value = cot.items[i].cantidad;
      row.querySelector(".it-desc").value = cot.items[i].descripcion;
      row.querySelector(".it-precio").value = cot.items[i].precio;
      wireItemRow(row, "facForm");
    });
    updateTotalsPreview("facForm");
  };
}

async function submitDoc(formId, tipo, form) {
  const items = readItems(formId);
  if (items.length === 0) { toast("Agrega al menos un renglón", true); return; }

  let ncfItem = null;
  if (tipo === "factura") {
    ncfItem = nextAvailableNcf();
    if (!ncfItem) { toast("No quedan comprobantes NCF disponibles. Agrega un nuevo rango en 'Comprobantes'.", true); return; }
  }

  const totals = calcTotals(items);
  const numero = nextDocNumber(tipo);
  const now = new Date();
  const doc = {
    id: crypto.randomUUID(),
    numero,
    fecha: fmtDate(now),
    cliente: form.cliente.value,
    rnc: form.rnc.value,
    direccion: form.direccion.value,
    atencion: form.atencion.value,
    idCliente: form.idCliente.value,
    trabajo: form.trabajo.value,
    condiciones: form.condiciones.value,
    vencimiento: form.vencimiento.value,
    comentarios: form.comentarios.value,
    items,
    ...totals
  };
  if (tipo === "factura") {
    doc.ncf = ncfItem.comprobante;
    const sel = $("#facturaFromCot").value;
    if (sel) doc.cotizacionId = sel;
  }

  showLoading(`Generando ${tipo}…`);
  try {
    const blob = generateDocPdf(doc, tipo);
    const filename = `${tipo === "factura" ? "FACT" : "COT"}-${numero.replace("/", "-")}-${doc.cliente.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    const subfolder = tipo === "factura" ? "Facturas" : "Cotizaciones";
    const path = await uploadPdf(subfolder, filename, blob);
    doc.pdfPath = path;

    if (tipo === "factura") {
      marcarNcfUsado(ncfItem.comprobante);
      DB.facturas.push(doc);
    } else {
      DB.cotizaciones.push(doc);
    }
    await dbSave();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();

    toast(`${tipo === "factura" ? "Factura" : "Cotización"} ${numero} generada y guardada en OneDrive`);
    form.reset();
    showView("dashboard");
  } catch (e) {
    console.error(e);
    toast("Error al generar/guardar: " + e.message, true);
  } finally {
    hideLoading();
  }
}

// ---------------- Dashboard / historial / NCF ----------------
function docCardHtml(doc, tipo) {
  return `
  <div class="doc-card">
    <div class="doc-card-main">
      <strong>${doc.numero}</strong>
      <span>${doc.cliente}</span>
      <span class="muted">${doc.fecha}</span>
      ${tipo === "factura" ? `<span class="pill">NCF ${doc.ncf}</span>` : ""}
    </div>
    <div class="doc-card-total">$${doc.total.toFixed(2)}</div>
  </div>`;
}

function renderDashboard() {
  $("#dashCards").innerHTML = `
    <div class="card"><span class="card-num">${DB.cotizaciones.length}</span><span>Cotizaciones</span></div>
    <div class="card"><span class="card-num">${DB.facturas.length}</span><span>Facturas</span></div>
    <div class="card"><span class="card-num">${DB.ncfPool.filter(x => !x.usado).length}</span><span>NCF disponibles</span></div>
  `;
  const recent = [...DB.cotizaciones.map(d => ({ ...d, tipo: "cotizacion" })), ...DB.facturas.map(d => ({ ...d, tipo: "factura" }))]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 8);
  $("#dashRecent").innerHTML = recent.length
    ? recent.map(d => docCardHtml(d, d.tipo)).join("")
    : `<p class="hint">Aún no hay documentos generados.</p>`;
}

function renderHistorial() {
  $("#histCotizaciones").innerHTML = DB.cotizaciones.slice().reverse().map(d => docCardHtml(d, "cotizacion")).join("") || `<p class="hint">Sin cotizaciones.</p>`;
  $("#histFacturas").innerHTML = DB.facturas.slice().reverse().map(d => docCardHtml(d, "factura")).join("") || `<p class="hint">Sin facturas.</p>`;
  $all(".tab-btn").forEach(b => b.onclick = () => {
    $all(".tab-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    $("#histCotizaciones").classList.toggle("hidden", b.dataset.tab !== "cotizaciones");
    $("#histFacturas").classList.toggle("hidden", b.dataset.tab !== "facturas");
  });
}

function renderNcf() {
  const rows = DB.ncfPool.map(x => `
    <tr class="${x.usado ? "used" : ""}">
      <td>${x.comprobante}</td>
      <td>${x.usado ? "Usado" : "Disponible"}</td>
    </tr>`).join("");
  $("#ncfTableWrap").innerHTML = `<table class="ncf-table"><thead><tr><th>Comprobante</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`;
  $("#addNcfBatchBtn").onclick = async () => {
    const prefijo = prompt("Prefijo (ej. B02)", "B02");
    if (!prefijo) return;
    const inicio = parseInt(prompt("Número inicial (ej. 11 para B0200000011)", "11"), 10);
    const cantidad = parseInt(prompt("Cantidad de comprobantes a agregar", "10"), 10);
    if (!inicio || !cantidad) return;
    agregarRangoNcf(prefijo, inicio, cantidad);
    showLoading("Guardando…");
    await dbSave();
    hideLoading();
    renderNcf();
    toast("Rango de comprobantes agregado");
  };
}

// ---------------- Arranque ----------------
async function boot() {
  await authInit();
  $("#loginBtn").onclick = authLogin;
  $("#loginBtnCenter").onclick = authLogin;
  $("#logoutBtn").onclick = authLogout;
  $all(".nav-btn").forEach(b => b.onclick = () => showView(b.dataset.view));

  if (activeAccount) {
    $("#userLabel").textContent = activeAccount.username;
    $("#userLabel").classList.remove("hidden");
    $("#loginBtn").classList.add("hidden");
    $("#logoutBtn").classList.remove("hidden");
    $("#mainNav").classList.remove("hidden");
    $("#view-login").classList.add("hidden");

    showLoading("Conectando con OneDrive…");
    try {
      await ensureFolders();
      await dbLoad();
      showView("dashboard");
    } catch (e) {
      console.error(e);
      toast("No se pudo conectar con OneDrive: " + e.message, true);
    } finally {
      hideLoading();
    }
  } else {
    showView("login");
  }
}

boot();
