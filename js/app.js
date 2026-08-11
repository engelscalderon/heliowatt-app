// ============================================================
// APP — navegación, formularios y flujo de guardado
// ============================================================
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

const CONDICIONES_PAGO_OPTIONS = [
  "100% Contra Entrega",
  "50% Contra Aprobación - 50% Contra Entrega",
  "Crédito a 15 Días",
  "Crédito a 30 Días",
  "Crédito a 60 Días"
];

let editContext = null; // { tipo: 'cotizacion'|'factura', id } cuando se está editando un documento existente

function renderDatalists() {
  let dlC = $("#dl-clientes");
  if (!dlC) {
    dlC = document.createElement("datalist");
    dlC.id = "dl-clientes";
    document.body.appendChild(dlC);
  }
  dlC.innerHTML = DB.catalog.clientes.map(c => `<option value="${c.cliente}">`).join("");

  let dlI = $("#dl-items");
  if (!dlI) {
    dlI = document.createElement("datalist");
    dlI.id = "dl-items";
    document.body.appendChild(dlI);
  }
  dlI.innerHTML = DB.catalog.items.map(i => `<option value="${i.descripcion}">`).join("");
}

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
  if (name === "cotizacion") { editContext = null; renderForm("cotForm", "cotizacion"); }
  if (name === "factura") { editContext = null; renderFacturaSelect(); renderForm("facForm", "factura"); }
  if (name === "historial") renderHistorial();
  if (name === "ncf") renderNcf();
}

function editDocument(tipo, id) {
  const list = tipo === "factura" ? DB.facturas : DB.cotizaciones;
  const doc = list.find(d => d.id === id);
  if (!doc) return;
  editContext = { tipo, id };
  $all(".view").forEach(v => v.classList.add("hidden"));
  $(`#view-${tipo}`).classList.remove("hidden");
  $all(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === tipo));
  if (tipo === "factura") renderFacturaSelect();
  renderForm(tipo === "factura" ? "facForm" : "cotForm", tipo, doc);
}

// ---------------- Formularios de documento ----------------
function itemRowHtml(idx) {
  return `
  <div class="item-row" data-idx="${idx}">
    <input type="number" class="it-cant" placeholder="Cant." step="0.01" value="1" required>
    <input type="text" class="it-desc" placeholder="Descripción" list="dl-items" required>
    <input type="number" class="it-precio" placeholder="Precio unit." step="0.01" required>
    <button type="button" class="btn-remove-item">✕</button>
  </div>`;
}

function renderForm(formId, tipo, prefillDoc) {
  const form = $(`#${formId}`);
  const isEdit = !!prefillDoc;
  form.innerHTML = `
    <div class="field-grid">
      <div class="field"><label>Cliente</label><input name="cliente" list="dl-clientes" required></div>
      <div class="field"><label>RNC / Cédula del cliente</label><input name="rnc"></div>
      <div class="field"><label>Dirección del cliente</label><input name="direccion"></div>
      <div class="field"><label>Atención (contacto)</label><input name="atencion"></div>
      <div class="field"><label>ID del cliente</label><input name="idCliente"></div>
      <div class="field"><label>Trabajo / servicio</label><input name="trabajo" required></div>
      <div class="field"><label>Condiciones de pago</label>
        <select name="condiciones">
          ${CONDICIONES_PAGO_OPTIONS.map(o => `<option value="${o}">${o}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Fecha de vencimiento</label><input name="vencimiento" placeholder="ej. 26-ago.-26"></div>
    </div>

    <h3>Renglones</h3>
    <div id="${formId}-items">${itemRowHtml(0)}</div>
    <button type="button" class="btn btn-outline" id="${formId}-addItem">+ Agregar renglón</button>

    <div class="field">
      <label>Comentarios</label>
      <textarea name="comentarios" rows="2"></textarea>
    </div>

    <div class="totals-preview" id="${formId}-totals">Subtotal: $0.00 · ITBIS: $0.00 · Total: $0.00</div>

    <div class="form-actions">
      <button type="submit" class="btn btn-primary">${isEdit ? "Guardar cambios" : (tipo === "factura" ? "Generar factura" : "Generar cotización")}</button>
      ${isEdit ? `<button type="button" class="btn btn-outline" id="${formId}-cancelEdit">Cancelar edición</button>` : ""}
    </div>
  `;

  // Autollenado de datos del cliente si coincide con el catálogo
  form.cliente.addEventListener("change", () => {
    const match = DB.catalog.clientes.find(c => c.cliente.trim().toLowerCase() === form.cliente.value.trim().toLowerCase());
    if (match) {
      form.rnc.value = match.rnc || form.rnc.value;
      form.direccion.value = match.direccion || form.direccion.value;
      form.atencion.value = match.atencion || form.atencion.value;
      form.idCliente.value = match.idCliente || form.idCliente.value;
    }
  });

  const itemsWrap = $(`#${formId}-items`);
  $(`#${formId}-addItem`).onclick = () => {
    const idx = itemsWrap.children.length;
    itemsWrap.insertAdjacentHTML("beforeend", itemRowHtml(idx));
    wireItemRow(itemsWrap.lastElementChild, formId);
  };
  wireItemRow(itemsWrap.firstElementChild, formId);

  if (isEdit) {
    form.cliente.value = prefillDoc.cliente || "";
    form.rnc.value = prefillDoc.rnc || "";
    form.direccion.value = prefillDoc.direccion || "";
    form.atencion.value = prefillDoc.atencion || "";
    form.idCliente.value = prefillDoc.idCliente || "";
    form.trabajo.value = prefillDoc.trabajo || "";
    if (prefillDoc.condiciones && !CONDICIONES_PAGO_OPTIONS.includes(prefillDoc.condiciones)) {
      form.condiciones.insertAdjacentHTML("afterbegin", `<option value="${prefillDoc.condiciones}">${prefillDoc.condiciones}</option>`);
    }
    form.condiciones.value = prefillDoc.condiciones || CONDICIONES_PAGO_OPTIONS[0];
    form.vencimiento.value = prefillDoc.vencimiento || "";
    form.comentarios.value = prefillDoc.comentarios || "";
    itemsWrap.innerHTML = prefillDoc.items.map((it, i) => itemRowHtml(i)).join("");
    $all(`#${formId}-items .item-row`).forEach((row, i) => {
      row.querySelector(".it-cant").value = prefillDoc.items[i].cantidad;
      row.querySelector(".it-desc").value = prefillDoc.items[i].descripcion;
      row.querySelector(".it-precio").value = prefillDoc.items[i].precio;
      wireItemRow(row, formId);
    });
    updateTotalsPreview(formId);
    const cancelBtn = $(`#${formId}-cancelEdit`);
    if (cancelBtn) cancelBtn.onclick = () => { editContext = null; showView("historial"); };
  }

  form.onsubmit = (e) => { e.preventDefault(); submitDoc(formId, tipo, form); };
}

function wireItemRow(row, formId) {
  row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => updateTotalsPreview(formId)));
  const descInput = row.querySelector(".it-desc");
  const precioInput = row.querySelector(".it-precio");
  descInput.addEventListener("change", () => {
    const match = DB.catalog.items.find(i => i.descripcion.trim().toLowerCase() === descInput.value.trim().toLowerCase());
    if (match && !precioInput.value) {
      precioInput.value = match.precio;
      updateTotalsPreview(formId);
    }
  });
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
    `Subtotal: $${fmtMoney(t.subtotal)} · ITBIS: $${fmtMoney(t.itebis)} · Total: $${fmtMoney(t.total)}`;
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
    if (cot.condiciones && !CONDICIONES_PAGO_OPTIONS.includes(cot.condiciones)) {
      form.condiciones.insertAdjacentHTML("afterbegin", `<option value="${cot.condiciones}">${cot.condiciones}</option>`);
    }
    form.condiciones.value = cot.condiciones || CONDICIONES_PAGO_OPTIONS[0];
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

  const isEditing = editContext && editContext.tipo === tipo;
  const totals = calcTotals(items);
  const list = tipo === "factura" ? DB.facturas : DB.cotizaciones;
  const existing = isEditing ? list.find(d => d.id === editContext.id) : null;

  let ncfItem = null;
  if (tipo === "factura" && !isEditing) {
    ncfItem = nextAvailableNcf();
    if (!ncfItem) { toast("No quedan comprobantes NCF disponibles. Agrega un nuevo rango en 'Comprobantes'.", true); return; }
  }

  const numero = isEditing ? existing.numero : nextDocNumber(tipo);
  const fecha = isEditing ? existing.fecha : fmtDate(new Date());
  const doc = {
    id: isEditing ? existing.id : crypto.randomUUID(),
    numero,
    fecha,
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
    doc.ncf = isEditing ? existing.ncf : ncfItem.comprobante;
    if (isEditing && existing.cotizacionId) doc.cotizacionId = existing.cotizacionId;
    const sel = $("#facturaFromCot") ? $("#facturaFromCot").value : "";
    if (!isEditing && sel) doc.cotizacionId = sel;
  }

  showLoading(isEditing ? "Guardando cambios…" : `Generando ${tipo}…`);
  try {
    const blob = generateDocPdf(doc, tipo);
    let path;
    if (isEditing && existing.pdfPath) {
      const parts = existing.pdfPath.split("/");
      const filename = parts.pop();
      const subfolder = parts.pop();
      path = await uploadPdf(subfolder, filename, blob);
    } else {
      const filename = `${tipo === "factura" ? "FACT" : "COT"}-${numero.replace("/", "-")}-${doc.cliente.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      const subfolder = tipo === "factura" ? "Facturas" : "Cotizaciones";
      path = await uploadPdf(subfolder, filename, blob);
    }
    doc.pdfPath = path;

    if (isEditing) {
      const idx = list.findIndex(d => d.id === existing.id);
      list[idx] = doc;
    } else if (tipo === "factura") {
      marcarNcfUsado(ncfItem.comprobante);
      DB.facturas.push(doc);
    } else {
      DB.cotizaciones.push(doc);
    }
    upsertCatalog(doc);
    await dbSave();
    renderDatalists();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = path.split("/").pop(); a.click();

    toast(`${tipo === "factura" ? "Factura" : "Cotización"} ${numero} ${isEditing ? "actualizada" : "generada"} y guardada en OneDrive`);
    editContext = null;
    form.reset();
    showView(isEditing ? "historial" : "dashboard");
  } catch (e) {
    console.error(e);
    toast("Error al generar/guardar: " + e.message, true);
  } finally {
    hideLoading();
  }
}

async function deleteDocument(tipo, id) {
  const list = tipo === "factura" ? DB.facturas : DB.cotizaciones;
  const doc = list.find(d => d.id === id);
  if (!doc) return;

  const confirmMsg = tipo === "factura"
    ? `¿Eliminar la factura ${doc.numero} de ${doc.cliente}?\n\nEl comprobante fiscal ${doc.ncf} quedará disponible de nuevo para usarse en otra factura.`
    : `¿Eliminar la cotización ${doc.numero} de ${doc.cliente}?`;
  if (!confirm(confirmMsg)) return;

  showLoading("Eliminando…");
  try {
    if (tipo === "factura" && doc.ncf) liberarNcf(doc.ncf);
    if (doc.pdfPath) await deleteOneDriveFile(doc.pdfPath);
    const idx = list.findIndex(d => d.id === id);
    if (idx >= 0) list.splice(idx, 1);
    await dbSave();
    toast(`${tipo === "factura" ? "Factura" : "Cotización"} ${doc.numero} eliminada${tipo === "factura" ? " · NCF liberado" : ""}`);
    renderHistorial();
    renderDashboard();
  } catch (e) {
    console.error(e);
    toast("Error al eliminar: " + e.message, true);
  } finally {
    hideLoading();
  }
}

// ---------------- Dashboard / historial / NCF ----------------
function docCardHtml(doc, tipo, editable) {
  return `
  <div class="doc-card">
    <div class="doc-card-main">
      <strong>${doc.numero}</strong>
      <span>${doc.cliente}</span>
      <span class="muted">${doc.fecha}</span>
      ${tipo === "factura" ? `<span class="pill">NCF ${doc.ncf}</span>` : ""}
    </div>
    <div class="doc-card-right">
      <div class="doc-card-total">$${fmtMoney(doc.total)}</div>
      ${editable ? `
        <button type="button" class="btn btn-outline btn-sm" onclick="editDocument('${tipo}','${doc.id}')">Editar</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteDocument('${tipo}','${doc.id}')">Eliminar</button>
      ` : ""}
    </div>
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
  $("#histCotizaciones").innerHTML = DB.cotizaciones.slice().reverse().map(d => docCardHtml(d, "cotizacion", true)).join("") || `<p class="hint">Sin cotizaciones.</p>`;
  $("#histFacturas").innerHTML = DB.facturas.slice().reverse().map(d => docCardHtml(d, "factura", true)).join("") || `<p class="hint">Sin facturas.</p>`;
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
  $("#loginBtn").onclick = authLogin;
  $("#loginBtnCenter").onclick = authLogin;
  $("#logoutBtn").onclick = authLogout;
  $all(".nav-btn").forEach(b => b.onclick = () => showView(b.dataset.view));

  try {
    await authInit();
  } catch (e) {
    console.error(e);
    toast(e.message, true);
    showView("login");
    return;
  }

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
      renderDatalists();
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
