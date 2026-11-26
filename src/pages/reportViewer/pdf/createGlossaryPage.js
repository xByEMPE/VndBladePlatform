export const makeCreateGlossaryPage = ({ addPageWithHeaderFooter }) =>
  async (pdf, pageWidth, pageHeight, margin, t) => {
    let currentY = 35;
    const footerSpace = 25;
    const maxY = pageHeight - footerSpace;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(`2. ${t("pdf.glossary")}`, margin, currentY);
    currentY += 15;

    pdf.setFontSize(16);
    pdf.text(`2.1 ${t("pdf.terms")}`, margin, currentY);
    currentY += 12;

    const terms = [
      { term: t("pdf.termBladeRoot"), def: t("pdf.defBladeRoot") },
      { term: t("pdf.termLeadingEdge"), def: t("pdf.defLeadingEdge") },
      { term: t("pdf.termSuctionSide"), def: t("pdf.defSuctionSide") },
      { term: t("pdf.termShell"), def: t("pdf.defShell") },
      { term: t("pdf.termSpar"), def: t("pdf.defSpar") },
      { term: t("pdf.termTrailingEdge"), def: t("pdf.defTrailingEdge") },
      { term: t("pdf.termPressureSide"), def: t("pdf.defPressureSide") },
      { term: t("pdf.termSMT"), def: t("pdf.defSMT") },
      { term: t("pdf.termCore"), def: t("pdf.defCore") },
      { term: t("pdf.termLPS"), def: t("pdf.defLPS") },
    ];

    // Encabezado de la tabla
    const col1Width = 45;
    const col2Width = pageWidth - margin * 2 - col1Width;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(230, 230, 230);
    pdf.rect(margin, currentY - 5, pageWidth - margin * 2, 8, "F");
    pdf.text(t("pdf.termOrAbbreviation"), margin + 2, currentY);
    pdf.text(t("pdf.definition"), margin + col1Width + 2, currentY);
    currentY += 5;

    // Filas de la tabla
    pdf.setFontSize(9);
    for (let i = 0; i < terms.length; i++) {
      const item = terms[i];

      const defTextLines = pdf.splitTextToSize(item.def, col2Width - 6);
      const rowHeight = Math.max(8, defTextLines.length * 4.5 + 4);

      if (currentY + rowHeight > maxY) {
        currentY = await addPageWithHeaderFooter(
          pdf,
          pageWidth,
          pageHeight,
          margin,
          t,
        );
      }

      // Fondo alternado
      if (i % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, "F");
      }

      // Bordes
      pdf.setDrawColor(215, 215, 215);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, currentY, col1Width, rowHeight);
      pdf.rect(margin + col1Width, currentY, col2Width, rowHeight);

      // Textos
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(50, 50, 50);
      pdf.text(item.term, margin + 2, currentY + 5);

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);
      pdf.text(defTextLines, margin + col1Width + 3, currentY + 5);

      currentY += rowHeight;
    }
  };
