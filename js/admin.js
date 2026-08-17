// ============================================================
// ADMIN — módulo administrativo: comprobantes, gastos, ingresos, análisis
// ============================================================

function initAdminSubtabs() {
  $all(".subtab-btn").forEach(b => {
    b.onclick = () => {
      $all(".subtab-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      $all(".subtab-panel").forEach(p => p.classList.add("hidden"));
      $(`#subtab-${b.dataset.subtab}`).classList.remove("hidden");
      renderAdminSubtab(b.dataset.subtab);
    };
  });
}

function renderAdminSubtab(subtab) {
  if (subtab === "comprobantes") renderNcf();
  if (subtab === "gastos") renderGastosPanel();
  if (subtab === "ingresos") renderIngresosPanel();
  if (subtab === "analisis") renderAnalisisPanel();
}

function renderAdministracion() {
  initAdminSubtabs();
  const active = $(".subtab-btn.active");
  renderAdminSubtab(active ? active.dataset.subtab : "comprobantes");
}

// ---------------- Gastos ----------------
function renderGastosPanel() {
  const form = $("#gastoForm");
  form.innerHTML = `
    <div class="field-grid">
      <div class="field"><label>Fecha</label><input type="date" name="fecha" required></div>
      <div class="field"><label>RNC / Cédula</label><input name="rncCedula"></div>
      <div class="field"><label>Razón Social / Nombre</label><input name="razonSocial" required></div>
      <div class="field"><label>Concepto</label><input name="concepto" required></div>
      <div class="field"><label>NCF</label><input name="ncf"></div>
      <div class="field"><label>Categoría</label>
        <select name="categoria">${GASTO_CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Valor Bruto</label><input type="number" step="0.01" name="valorBruto" required></div>
      <div class="field"><label>% ITBIS</label><input type="number" step="0.01" name="itbisPct" value="${DEFAULT_ITBIS_PCT}"></div>
      <div class="field"><label>Otros Impuestos (nombre)</label><input name="otrosImpuestosNombre" placeholder="ej. Propina Legal, Impuesto Exportación"></div>
      <div class="field"><label>% Otros Impuestos</label><input type="number" step="0.01" name="otrosImpuestosPct" value="0"></div>
    </div>
    <div class="totals-preview" id="gastoNetoPreview">ITBIS: $0.00 · Otros Impuestos: $0.00 · Valor Neto: $0.00</div>
    <button type="submit" class="btn btn-primary">Registrar gasto</button>
  `;
  const updatePreview = () => {
    const bruto = parseFloat(form.valorBruto.value) || 0;
    const itbisPct = parseFloat(form.itbisPct.value) || 0;
    const itbisValor = Math.round(bruto * (itbisPct / 100) * 100) / 100;
    const otrosPct = parseFloat(form.otrosImpuestosPct.value) || 0;
    const otrosValor = Math.round(bruto * (otrosPct / 100) * 100) / 100;
    $("#gastoNetoPreview").textContent =
      `ITBIS: $${fmtMoney(itbisValor)} · Otros Impuestos: $${fmtMoney(otrosValor)} · Valor Neto: $${fmtMoney(bruto + itbisValor + otrosValor)}`;
  };
  form.valorBruto.addEventListener("input", updatePreview);
  form.itbisPct.addEventListener("input", updatePreview);
  form.otrosImpuestosPct.addEventListener("input", updatePreview);

  form.onsubmit = async (e) => {
    e.preventDefault();
    showLoading("Guardando gasto…");
    try {
      addGasto({
        fecha: fmtDate(new Date(form.fecha.value + "T00:00:00")),
        rncCedula: form.rncCedula.value,
        razonSocial: form.razonSocial.value,
        concepto: form.concepto.value,
        ncf: form.ncf.value,
        categoria: form.categoria.value,
        valorBruto: parseFloat(form.valorBruto.value) || 0,
        itbisPct: parseFloat(form.itbisPct.value) || 0,
        otrosImpuestosNombre: form.otrosImpuestosNombre.value,
        otrosImpuestosPct: parseFloat(form.otrosImpuestosPct.value) || 0
      });
      await dbSave();
      toast("Gasto registrado");
      form.reset();
      form.itbisPct.value = DEFAULT_ITBIS_PCT;
      updatePreview();
      renderGastosTable();
    } catch (e2) {
      console.error(e2);
      toast("Error al guardar: " + e2.message, true);
    } finally {
      hideLoading();
    }
  };

  $("#exportGastosBtn").onclick = () => exportGastosCsv(DB.gastos);

  renderGastosTable();
}

function exportGastosCsv(gastos) {
  const header = ["Item", "Fecha", "RNC/Cédula", "Razón Social/Nombre", "Concepto", "NCF", "Categoría", "Valor Bruto", "% ITBIS", "ITBIS", "Otros Impuestos", "% Otros Impuestos", "Valor Otros Impuestos", "Valor Neto"];
  const lines = [header.join(",")];
  gastos.slice().sort((a, b) => a.item - b.item).forEach(g => {
    lines.push([
      g.item, g.fecha, g.rncCedula, g.razonSocial, g.concepto, g.ncf, g.categoria,
      g.valorBruto.toFixed(2), (g.itbisPct === undefined ? "" : g.itbisPct.toFixed(2)), g.itbis.toFixed(2),
      g.otrosImpuestosNombre || "", (g.otrosImpuestosPct || 0).toFixed(2), (g.otrosImpuestosValor || 0).toFixed(2),
      g.valorNeto.toFixed(2)
    ].map(csvEscape).join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Gastos_HelioWatt_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderGastosTable() {
  const gastos = DB.gastos.slice().sort((a, b) => b.item - a.item);
  const t = gastoTotals(DB.gastos);
  const rows = gastos.map(g => `
    <tr>
      <td>${g.item}</td>
      <td>${g.fecha}</td>
      <td>${g.rncCedula}</td>
      <td>${g.razonSocial}</td>
      <td>${g.concepto}</td>
      <td>${g.ncf}</td>
      <td>${g.categoria}</td>
      <td class="num">$${fmtMoney(g.valorBruto)}</td>
      <td class="num">$${fmtMoney(g.itbis)} (${g.itbisPct === undefined ? 18 : g.itbisPct}%)</td>
      <td>${g.otrosImpuestosNombre ? `${g.otrosImpuestosNombre} (${g.otrosImpuestosPct}%)` : ""}</td>
      <td class="num">$${fmtMoney(g.otrosImpuestosValor || 0)}</td>
      <td class="num">$${fmtMoney(g.valorNeto)}</td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="handleDeleteGasto('${g.id}')">Eliminar</button></td>
    </tr>`).join("");

  $("#gastosTableWrap").innerHTML = `
    <div class="table-scroll">
    <table class="data-table">
      <thead><tr>
        <th>ITEM</th><th>Fecha</th><th>RNC/Cédula</th><th>Razón Social/Nombre</th><th>Concepto</th>
        <th>NCF</th><th>Categoría</th><th>Valor Bruto</th><th>ITBIS</th><th>Otros Impuestos</th><th>Valor Otros Imp.</th><th>Valor Neto</th><th></th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="13" class="hint">Sin gastos registrados.</td></tr>`}</tbody>
      <tfoot><tr>
        <td colspan="7"><strong>Totales</strong></td>
        <td class="num"><strong>$${fmtMoney(t.valorBruto)}</strong></td>
        <td class="num"><strong>$${fmtMoney(t.itbis)}</strong></td>
        <td></td>
        <td class="num"><strong>$${fmtMoney(t.otrosImpuestosValor)}</strong></td>
        <td class="num"><strong>$${fmtMoney(t.valorNeto)}</strong></td>
        <td></td>
      </tr></tfoot>
    </table>
    </div>`;
}

async function handleDeleteGasto(id) {
  if (!confirm("¿Eliminar este gasto?")) return;
  showLoading("Eliminando…");
  try {
    deleteGasto(id);
    await dbSave();
    renderGastosTable();
    toast("Gasto eliminado");
  } catch (e) {
    toast("Error al eliminar: " + e.message, true);
  } finally {
    hideLoading();
  }
}

// ---------------- Ingresos (generado desde facturas) ----------------
function renderIngresosPanel() {
  const facturas = DB.facturas.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const totalSub = facturas.reduce((s, f) => s + f.subtotal, 0);
  const totalItbis = facturas.reduce((s, f) => s + f.itebis, 0);
  const totalGeneral = facturas.reduce((s, f) => s + f.total, 0);

  const rows = facturas.map(f => `
    <tr>
      <td>${f.numero}</td>
      <td>${f.fecha}</td>
      <td>${f.cliente}</td>
      <td>${f.ncf || ""}</td>
      <td class="num">$${fmtMoney(f.subtotal)}</td>
      <td class="num">$${fmtMoney(f.itebis)}</td>
      <td class="num">$${fmtMoney(f.total)}</td>
    </tr>`).join("");

  $("#ingresosTableWrap").innerHTML = `
    <div class="table-scroll">
    <table class="data-table">
      <thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>NCF</th><th>Ingreso (base)</th><th>ITBIS</th><th>Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="hint">Sin facturas emitidas todavía.</td></tr>`}</tbody>
      <tfoot><tr>
        <td colspan="4"><strong>Totales</strong></td>
        <td class="num"><strong>$${fmtMoney(totalSub)}</strong></td>
        <td class="num"><strong>$${fmtMoney(totalItbis)}</strong></td>
        <td class="num"><strong>$${fmtMoney(totalGeneral)}</strong></td>
      </tr></tfoot>
    </table>
    </div>`;

  $("#exportIngresosBtn").onclick = () => exportIngresosCsv(facturas);
}

function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportIngresosCsv(facturas) {
  const header = ["Factura", "Fecha", "Cliente", "RNC", "NCF", "Ingreso (base)", "ITBIS", "Total"];
  const lines = [header.join(",")];
  facturas.forEach(f => {
    lines.push([f.numero, f.fecha, f.cliente, f.rnc, f.ncf || "", f.subtotal.toFixed(2), f.itebis.toFixed(2), f.total.toFixed(2)].map(csvEscape).join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Ingresos_HelioWatt_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------- Análisis ----------------
function parseFechaDMY(fecha) {
  // "dd/mm/yyyy" -> Date
  const [d, m, y] = fecha.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

function renderAnalisisPanel() {
  const ingresosBrutos = DB.facturas.reduce((s, f) => s + f.subtotal, 0);
  const porCategoria = {};
  GASTO_CATEGORIAS.forEach(c => porCategoria[c] = 0);
  DB.gastos.forEach(g => { porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.valorNeto; });
  const totalGastos = Object.values(porCategoria).reduce((a, b) => a + b, 0);
  const utilidadBruta = ingresosBrutos - totalGastos;
  const proyeccionRST = ingresosBrutos * 0.07;

  // Serie mensual para la gráfica
  const monthsSet = new Set();
  const ingresosPorMes = {};
  const gastosPorMes = {};
  DB.facturas.forEach(f => {
    try {
      const k = monthKey(parseFechaDMY(f.fecha));
      monthsSet.add(k);
      ingresosPorMes[k] = (ingresosPorMes[k] || 0) + f.subtotal;
    } catch (e) { /* ignorar fechas mal formadas */ }
  });
  DB.gastos.forEach(g => {
    try {
      const k = monthKey(parseFechaDMY(g.fecha));
      monthsSet.add(k);
      gastosPorMes[k] = (gastosPorMes[k] || 0) + g.valorNeto;
    } catch (e) { /* ignorar */ }
  });
  const months = Array.from(monthsSet).sort();

  $("#analisisWrap").innerHTML = `
    <h2>Segregación de datos</h2>
    <div class="cards">
      <div class="card"><span class="card-num">$${fmtMoney(ingresosBrutos)}</span><span>Ingresos (base)</span></div>
      <div class="card"><span class="card-num">$${fmtMoney(porCategoria["Compras"] || 0)}</span><span>Compras</span></div>
      <div class="card"><span class="card-num">$${fmtMoney(porCategoria["Pago de Personal"] || 0)}</span><span>Pago de Personal</span></div>
      <div class="card"><span class="card-num">$${fmtMoney(porCategoria["Gastos Generales"] || 0)}</span><span>Gastos Generales</span></div>
      <div class="card"><span class="card-num">$${fmtMoney(utilidadBruta)}</span><span>Utilidad estimada</span></div>
    </div>

    <h2>Ingresos vs. Gastos por mes</h2>
    <div id="chartWrap">${months.length ? buildBarChartSvg(months, ingresosPorMes, gastosPorMes) : `<p class="hint">Aún no hay suficientes datos con fecha para graficar.</p>`}</div>

    <h2>Gastos por categoría</h2>
    <div id="pieChartWrap">${totalGastos > 0 ? buildPieChartSvg(porCategoria) : `<p class="hint">Aún no hay gastos registrados para graficar.</p>`}</div>

    <h2>Proyección de impuestos — Régimen Simplificado de Tributación (RST por Ingresos)</h2>
    <div class="tax-box">
      <p>Para una persona jurídica acogida al <strong>RST por Ingresos</strong>, la cuota se estima con una tasa fija del <strong>7% sobre los ingresos brutos declarados</strong>.</p>
      <div class="tax-line"><span>Ingresos brutos declarados</span><strong>$${fmtMoney(ingresosBrutos)}</strong></div>
      <div class="tax-line total"><span>Proyección de impuesto (7%)</span><strong>$${fmtMoney(proyeccionRST)}</strong></div>
      <p class="hint">Esto es una estimación orientativa, no una declaración oficial. Verifica siempre la tasa vigente y las condiciones de tu régimen con tu contador o la DGII antes de pagar.</p>
    </div>
  `;
}

function buildPieChartSvg(porCategoria) {
  const colors = { "Compras": "#1c6ea8", "Pago de Personal": "#f4a52c", "Gastos Generales": "#c0392b" };
  const total = Object.values(porCategoria).reduce((a, b) => a + b, 0) || 1;
  const cx = 120, cy = 120, r = 100;
  let angleStart = -Math.PI / 2;
  let slices = "";
  let legend = "";

  Object.entries(porCategoria).forEach(([cat, val]) => {
    if (!val) { legend += legendRow(cat, val, total, colors[cat]); return; }
    const angle = (val / total) * Math.PI * 2;
    const angleEnd = angleStart + angle;
    const x1 = cx + r * Math.cos(angleStart), y1 = cy + r * Math.sin(angleStart);
    const x2 = cx + r * Math.cos(angleEnd), y2 = cy + r * Math.sin(angleEnd);
    const largeArc = angle > Math.PI ? 1 : 0;
    const isFullCircle = Math.abs(val - total) < 0.001;
    const path = isFullCircle
      ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    slices += `<path d="${path}" fill="${colors[cat] || "#888"}" stroke="white" stroke-width="2"></path>`;
    angleStart = angleEnd;
    legend += legendRow(cat, val, total, colors[cat]);
  });

  return `
  <div class="pie-wrap">
    <svg viewBox="0 0 240 240" width="240" height="240">${slices}</svg>
    <div class="pie-legend">${legend}</div>
  </div>`;
}

function legendRow(cat, val, total, color) {
  const pct = ((val / total) * 100).toFixed(1);
  return `<div class="legend-item"><span class="dot" style="background:${color || "#888"}"></span> ${cat}: $${fmtMoney(val)} (${pct}%)</div>`;
}

function buildBarChartSvg(months, ingresosPorMes, gastosPorMes) {
  const w = 700, h = 320, padL = 60, padB = 50, padT = 20, padR = 20;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxVal = Math.max(1, ...months.map(m => Math.max(ingresosPorMes[m] || 0, gastosPorMes[m] || 0)));
  const groupW = chartW / months.length;
  const barW = Math.min(28, groupW / 3);

  let bars = "";
  let labels = "";
  months.forEach((m, i) => {
    const gx = padL + i * groupW + groupW / 2;
    const ing = ingresosPorMes[m] || 0;
    const gas = gastosPorMes[m] || 0;
    const ingH = (ing / maxVal) * chartH;
    const gasH = (gas / maxVal) * chartH;
    const y0 = padT + chartH;
    bars += `<rect x="${gx - barW - 2}" y="${y0 - ingH}" width="${barW}" height="${ingH}" fill="#1c6ea8"></rect>`;
    bars += `<rect x="${gx + 2}" y="${y0 - gasH}" width="${barW}" height="${gasH}" fill="#f4a52c"></rect>`;
    labels += `<text x="${gx}" y="${h - padB + 18}" font-size="10" text-anchor="middle" fill="#555">${monthLabel(m)}</text>`;
  });

  // líneas de referencia
  let gridLines = "";
  for (let g = 0; g <= 4; g++) {
    const val = (maxVal / 4) * g;
    const y = padT + chartH - (val / maxVal) * chartH;
    gridLines += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#e3e6ea" stroke-width="1"></line>`;
    gridLines += `<text x="${padL - 8}" y="${y + 4}" font-size="9" text-anchor="end" fill="#888">$${Math.round(val).toLocaleString("en-US")}</text>`;
  }

  return `
  <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px">
    ${gridLines}
    ${bars}
    ${labels}
    <line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="#999" stroke-width="1"></line>
  </svg>
  <div class="chart-legend">
    <span class="legend-item"><span class="dot" style="background:#1c6ea8"></span> Ingresos</span>
    <span class="legend-item"><span class="dot" style="background:#f4a52c"></span> Gastos</span>
  </div>`;
}
