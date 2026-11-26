export const makeCreateIntroductionPage = ({ turbine, project, totalImages, totalImagesByBlade, getCoordinatesDisplay, addPageWithHeaderFooter }) =>
  async (
    pdf,
    pageWidth,
    pageHeight,
    margin,
    t,
    reportDamages,
    pageTracker,
    startY = 35,
  ) => {
    let currentY = startY;
    const footerSpace = 25;
    const maxY = pageHeight - footerSpace;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(`3. ${t("pdf.introduction")}`, margin, currentY);
    currentY += 15;

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`3.1 ${t("pdf.dateAndWTG")}`, margin, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const dateText = t("pdf.dateAndWTGText", {
      inspectionDate: turbine?.inspection_date
        ? new Date(turbine.inspection_date).toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
        : t("pdf.theInspectionDate"),
      turbineName: turbine?.turbine_name || "TXX",
      windFarm: project?.wind_farm || t("pdf.windFarm"),
      client: project?.client || t("pdf.theClient"),
    });
    const splitDateText = pdf.splitTextToSize(dateText, pageWidth - margin * 2);
    pdf.text(splitDateText, margin, currentY);
    currentY += splitDateText.length * 5 + 8;

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`3.2 ${t("pdf.technology")}`, margin, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const techText = t("pdf.technologyDescription");
    const splitTechText = pdf.splitTextToSize(techText, pageWidth - margin * 2);
    pdf.text(splitTechText, margin, currentY);
    currentY += splitTechText.length * 5 + 8;

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`3.3 ${t("pdf.target")}`, margin, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const targetText = t("pdf.targetText", {
      turbineName: turbine?.turbine_name || "TXX",
      totalImages: totalImages,
      totalDamages: reportDamages.length,
    });
    const splitTargetText = pdf.splitTextToSize(
      targetText,
      pageWidth - margin * 2,
    );
    pdf.text(splitTargetText, margin, currentY);
    currentY += splitTargetText.length * 5 + 12;

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`3.4 ${t("pdf.generalInformation")}`, margin, currentY);
    if (pageTracker) pageTracker.introGeneral = pdf.internal.getNumberOfPages();
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const genInfoDesc = t("pdf.generalInformationDescription");
    if (genInfoDesc) {
      const splitGenInfoDesc = pdf.splitTextToSize(
        genInfoDesc,
        pageWidth - margin * 2,
      );
      pdf.text(splitGenInfoDesc, margin, currentY);
      currentY += splitGenInfoDesc.length * 5 + 6;
    }

    const bladeAImages = totalImagesByBlade["Blade A"] || 0;
    const bladeBImages = totalImagesByBlade["Blade B"] || 0;
    const bladeCImages = totalImagesByBlade["Blade C"] || 0;

    const bladeADamages = reportDamages.filter(
      (d) => d.blade === "Blade A",
    ).length;
    const bladeBDamages = reportDamages.filter(
      (d) => d.blade === "Blade B",
    ).length;
    const bladeCDamages = reportDamages.filter(
      (d) => d.blade === "Blade C",
    ).length;

    const generalInfo = [
      {
        field: t("pdf.windPark").replace(":", ""),
        value: project?.wind_farm || "N/A",
      },
      {
        field: t("pdf.locationDetails"),
        value: getCoordinatesDisplay(turbine?.coordinates) || "N/A",
      },
      { field: t("pdf.owner"), value: project?.client || "N/A" },
      { field: t("pdf.wtgType"), value: turbine?.model || "N/A" },
      { field: t("pdf.wtgNo"), value: turbine?.turbine_name || "N/A" },
      {
        field: t("pdf.inspectionDate").replace(":", ""),
        value: turbine?.inspection_date
          ? new Date(turbine.inspection_date).toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
          : "N/A",
      },
      {
        field: t("pdf.totalDamages"),
        value: `${reportDamages.length} ${t(
          "pdf.damages",
        )} (Blade A:${bladeADamages}, Blade B:${bladeBDamages}, Blade C:${bladeCDamages})`,
      },
      {
        field: t("pdf.reportGenerated"),
        value: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }),
      },
    ];

    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0); // Garantizamos que empiece en negro

    for (let i = 0; i < generalInfo.length; i++) {
      const item = generalInfo[i];

      // Reducimos el umbral para aprovechar más el final de la hoja
      if (currentY > maxY - 10) {
        currentY = await addPageWithHeaderFooter(
          pdf,
          pageWidth,
          pageHeight,
          margin,
          t,
        );
        // RESTAURAR ESTILOS: Después de dibujar el footer gris, volvemos a negro y tamaño 9
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
      }

      pdf.setFont("helvetica", "bold");
      pdf.text(`${item.field}:`, margin, currentY);
      pdf.setFont("helvetica", "normal");
      pdf.text(item.value, margin + 65, currentY);

      // Reducimos el espaciado de 8 a 7 para compactar la tabla y evitar el salto innecesario
      currentY += 7;
    }
    return currentY;
  };
