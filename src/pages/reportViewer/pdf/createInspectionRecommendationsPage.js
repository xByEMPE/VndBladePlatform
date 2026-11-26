  // === Crear página de recomendaciones ===
export const makeCreateInspectionRecommendationsPage = ({ addPageWithHeaderFooter }) =>
  async (
    pdf,
    pageWidth,
    pageHeight,
    margin,
    t,
    reportDamages,
    startY = 35,
  ) => {
    let currentY = startY;
    const footerSpace = 25;
    const maxY = pageHeight - footerSpace;

    if (currentY > maxY - 40) {
      currentY = await addPageWithHeaderFooter(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        t,
      );
    } else if (currentY > 35) {
      currentY += 15;
    }

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");

    // El título es 4.4 si hay daños, o 4.3 si no hay daños
    const titleNumber = reportDamages.length > 0 ? "4.4" : "4.3";
    pdf.text(
      `${titleNumber} ${t("pdf.inspectionRecommendations")}`,
      margin,
      currentY,
    );
    currentY += 15;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    // Construimos la lista exacta solicitada basada en la normativa DNVGL-ST-0376
    // (Estos textos ya existen en tu archivo reports.json original)
    const recommendations = [
      t("pdf.dnvReference1"), // "Se llevó a cabo una inspección visual..."
      "",
      t("pdf.dnvReference2"), // "Planificacion de inpecciones internas..."
      "",
      t("pdf.dnvBullet1"),
      t("pdf.dnvBullet2"),
      t("pdf.dnvBullet3"),
      t("pdf.dnvBullet4"),
      t("pdf.dnvBullet5"),
      t("pdf.dnvBullet6"),
    ];

    for (const rec of recommendations) {
      if (currentY > maxY - 15) {
        currentY = await addPageWithHeaderFooter(
          pdf,
          pageWidth,
          pageHeight,
          margin,
          t,
        );
      }

      if (rec === "") {
        currentY += 4; // Espacio entre párrafos
        continue;
      }

      // Si el texto es una viñeta, lo indentamos ligeramente
      const isBullet = rec.trim().startsWith("•");
      const textX = isBullet ? margin + 5 : margin;
      const textWidth = isBullet
        ? pageWidth - margin * 2 - 5
        : pageWidth - margin * 2;

      const recLines = pdf.splitTextToSize(rec, textWidth);
      pdf.text(recLines, textX, currentY);
      currentY += recLines.length * 5 + 2;
    }

    return currentY;
  };
