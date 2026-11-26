export const createContentsPage = async (
    pdf,
    pageWidth,
    pageHeight,
    margin,
    t,
    pageTracker,
    hasDamages,
  ) => {
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.contents"), margin, 40);

    let currentY = 60;

    const capitalizeFirst = (str) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    // Estructura de elementos con su nivel de jerarquía y página real
    const tocItems = [
      {
        label: `1. ${t("pdf.executiveSummary").toUpperCase()}`,
        page: pageTracker?.execSummary || 3,
        isMain: true,
      },
      {
        label: `2. ${t("pdf.glossary").toUpperCase()}`,
        page: pageTracker?.glossary || 4,
        isMain: true,
      },
      {
        label: `2.1 ${capitalizeFirst(t("pdf.terms"))}`,
        page: pageTracker?.glossary || 4,
        isMain: false,
      },
      {
        label: `2.2 ${capitalizeFirst(t("pdf.classificationOfAnnotations"))}`,
        page: pageTracker?.glossaryClassification || 5,
        isMain: false,
      },
      {
        label: `3. ${t("pdf.introduction").toUpperCase()}`,
        page: pageTracker?.intro || 6,
        isMain: true,
      },
      {
        label: `3.1 ${capitalizeFirst(t("pdf.dateAndWTG"))}`,
        page: pageTracker?.intro || 6,
        isMain: false,
      },
      {
        label: `3.2 ${capitalizeFirst(t("pdf.technology"))}`,
        page: pageTracker?.intro || 6,
        isMain: false,
      },
      {
        label: `3.3 ${capitalizeFirst(t("pdf.target"))}`,
        page: pageTracker?.intro || 6,
        isMain: false,
      },
      {
        label: `3.4 ${capitalizeFirst(t("pdf.generalInformation"))}`,
        page: pageTracker?.introGeneral || 7,
        isMain: false,
      },
      {
        label: `4. ${t("pdf.inspectionResults").toUpperCase()}`,
        page: pageTracker?.results || 8,
        isMain: true,
      },
      {
        label: `4.1 ${capitalizeFirst(t("pdf.overallSummary"))}`,
        page: pageTracker?.results || 8,
        isMain: false,
      },
      {
        label: `4.2 ${capitalizeFirst(t("pdf.damageDistribution"))}`,
        page: pageTracker?.results || 8,
        isMain: false,
      },
    ];

    if (hasDamages) {
      tocItems.push({
        label: `4.3 ${capitalizeFirst(t("pdf.detailedDamageInformation"))}`,
        page: pageTracker?.resultsDetailed || 9,
        isMain: false,
      });
      tocItems.push({
        label: `4.4 ${capitalizeFirst(t("pdf.inspectionRecommendations"))}`,
        page: pageTracker?.recommendations || 10,
        isMain: false,
      });
    } else {
      tocItems.push({
        label: `4.3 ${capitalizeFirst(t("pdf.inspectionRecommendations"))}`,
        page: pageTracker?.recommendations || 9,
        isMain: false,
      });
    }

    const rightMargin = pageWidth - margin;

    tocItems.forEach((item) => {
      // Configuración de fuente según jerarquía
      pdf.setFont("helvetica", item.isMain ? "bold" : "normal");
      pdf.setFontSize(item.isMain ? 11 : 10);
      pdf.setTextColor(0, 0, 0);

      // Indentación: los subtítulos empiezan 5mm más a la derecha
      const startX = item.isMain ? margin : margin + 5;
      const pageStr = String(item.page);

      // Calcular anchos para la línea de puntos
      const labelWidth = pdf.getTextWidth(item.label);
      const pageNumWidth = pdf.getTextWidth(pageStr);
      const dotWidth = pdf.getTextWidth(".");

      const textEndX = startX + labelWidth;
      const dotsStartX = textEndX + 3;
      const dotsEndX = rightMargin - pageNumWidth - 3;
      const dotsAreaWidth = dotsEndX - dotsStartX;

      // Dibujar texto
      pdf.text(item.label, startX, currentY);

      // Dibujar puntos dinámicos (solo si hay espacio)
      if (dotsAreaWidth > dotWidth * 3) {
        const numDots = Math.floor(dotsAreaWidth / dotWidth);
        const dots = ".".repeat(numDots);
        pdf.setTextColor(180, 180, 180); // Puntos en gris claro
        pdf.setFont("helvetica", "normal");

        // Centrar los puntos en el espacio sobrante
        const actualDotsWidth = pdf.getTextWidth(dots);
        const finalDotsX = dotsStartX + (dotsAreaWidth - actualDotsWidth) / 2;
        pdf.text(dots, finalDotsX, currentY);
      }

      // Dibujar número de página
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", item.isMain ? "bold" : "normal");
      pdf.text(pageStr, rightMargin, currentY, { align: "right" });

      // Espaciado dinámico: más espacio antes de un título principal
      currentY += item.isMain ? 10 : 8;
    });
  };
