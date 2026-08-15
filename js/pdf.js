// ============================================================
// PDF — genera la cotización/factura con el formato de HelioWatt
// ============================================================
function generateDocPdf(doc, tipo) {
  // tipo: "cotizacion" | "factura"
  const c = APP_CONFIG.company;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 40;
  let y = 40;

  // ---- Encabezado empresa ----
  pdf.setDrawColor(20, 20, 20);
  pdf.setLineWidth(1);
  pdf.rect(margin, y, pageW - margin * 2, 90);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(c.nombre, margin + 12, y + 22);
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(10);
  pdf.text(c.tagline, margin + 12, y + 36);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(c.direccion, margin + 12, y + 50);
  pdf.text(c.ciudad, margin + 12, y + 61);
  pdf.text(`RNC: ${c.rnc}`, margin + 12, y + 72);
  pdf.text(c.telefonos, margin + 12, y + 83);

  if (typeof LOGO_BASE64 !== "undefined") {
    const logoSize = 84;
    pdf.addImage(LOGO_BASE64, "PNG", pageW - margin - logoSize - 6, y + 3, logoSize, logoSize);
  }

  y += 100;

  // ---- Cliente + datos documento ----
  const boxH = 70;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("PARA", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(doc.cliente || "", margin + 45, y);
  pdf.text(doc.rnc || "", margin + 45, y + 12);
  pdf.text(doc.direccion || "", margin + 45, y + 24);
  pdf.setFont("helvetica", "bold");
  pdf.text("ATENCIÓN", margin, y + 36);
  pdf.setFont("helvetica", "normal");
  pdf.text(doc.atencion || "", margin + 60, y + 36);

  const rx = pageW - margin - 220;
  const label = tipo === "factura" ? "N.º FACTURA" : "N.º COTIZACIÓN";
  pdf.setFont("helvetica", "bold");
  pdf.text(label, rx, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(doc.numero, rx + 100, y);
  pdf.setFont("helvetica", "bold");
  pdf.text("FECHA", rx, y + 12);
  pdf.setFont("helvetica", "normal");
  pdf.text(doc.fecha, rx + 100, y + 12);
  if (tipo === "factura") {
    pdf.setFont("helvetica", "bold");
    pdf.text("NCF", rx, y + 24);
    pdf.setFont("helvetica", "normal");
    pdf.text(doc.ncf || "", rx + 100, y + 24);
  }
  pdf.setFont("helvetica", "bold");
  pdf.text("ID. DEL CLIENTE", rx, y + 36);
  pdf.setFont("helvetica", "normal");
  pdf.text(String(doc.idCliente || ""), rx + 100, y + 36);

  y += boxH;

  // ---- Barra vendedor/trabajo ----
  pdf.setFillColor(20, 20, 20);
  pdf.rect(margin, y, pageW - margin * 2, 16, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.text("VENDEDOR", margin + 4, y + 11);
  pdf.text("TRABAJO", margin + 90, y + 11);
  pdf.text("CONDICIONES DE PAGO", pageW - margin - 210, y + 11);
  pdf.text("FECHA DE VENCIMIENTO", pageW - margin - 100, y + 11);
  pdf.setTextColor(0, 0, 0);
  y += 26;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(doc.trabajo || "", margin + 90, y);
  pdf.text(doc.condiciones || "100% Contra Entrega", pageW - margin - 210, y);
  pdf.text(doc.vencimiento || "", pageW - margin - 100, y);
  y += 18;

  // ---- Tabla de items ----
  const rows = doc.items.map(it => [
    it.cantidad.toFixed(2),
    it.descripcion,
    `$ ${fmtMoney(it.precio)}`,
    `$ ${fmtMoney(it.cantidad * it.precio)}`
  ]);

  pdf.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [["CANTIDAD", "DESCRIPCIÓN", "PRECIO POR UNIDAD", "SUB-TOTAL"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [20, 20, 20], textColor: 255, fontSize: 8 },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 60, halign: "right" },
      2: { cellWidth: 110, halign: "right" },
      3: { cellWidth: 90, halign: "right" }
    }
  });

  y = pdf.lastAutoTable.finalY;

  // ---- Comentarios + totales ----
  const totalsW = 200;
  const commentsW = pageW - margin * 2 - totalsW;
  const totalsX = margin + commentsW;
  const rowH = 16;

  pdf.setDrawColor(20, 20, 20);
  pdf.rect(margin, y, commentsW, rowH * 3);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("COMENTARIOS", margin + 4, y + 11, { align: "left" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const commentLines = pdf.splitTextToSize(doc.comentarios || "", commentsW - 10);
  pdf.text(commentLines, margin + 4, y + 24);

  pdf.rect(totalsX, y, totalsW, rowH);
  pdf.setFont("helvetica", "bold");
  pdf.text("SUBTOTAL", totalsX + 4, y + 11);
  pdf.text(`$ ${fmtMoney(doc.subtotal)}`, totalsX + totalsW - 4, y + 11, { align: "right" });

  pdf.rect(totalsX, y + rowH, totalsW, rowH);
  pdf.text("ITBIS 18%", totalsX + 4, y + rowH + 11);
  pdf.text(`$ ${fmtMoney(doc.itebis)}`, totalsX + totalsW - 4, y + rowH + 11, { align: "right" });

  pdf.setFillColor(235, 235, 235);
  pdf.rect(totalsX, y + rowH * 2, totalsW, rowH, "F");
  pdf.rect(totalsX, y + rowH * 2, totalsW, rowH);
  pdf.setFontSize(10);
  pdf.text("TOTAL", totalsX + 4, y + rowH * 2 + 12);
  pdf.text(`$ ${fmtMoney(doc.total)}`, totalsX + totalsW - 4, y + rowH * 2 + 12, { align: "right" });

  y += rowH * 3 + 20;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Recibido Por: ___________________________", margin, y);
  y += 20;

  // ---- Pie ----
  pdf.setFillColor(20, 20, 20);
  pdf.rect(margin, y, pageW - margin * 2, 34, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("GRACIAS POR SU CONFIANZA", pageW / 2, y + 14, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  const payLines = pdf.splitTextToSize(c.pago, pageW - margin * 2 - 20);
  pdf.text(payLines, pageW / 2, y + 26, { align: "center" });
  pdf.setTextColor(0, 0, 0);

  return pdf.output("blob");
}
