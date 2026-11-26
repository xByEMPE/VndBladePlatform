  // === Función para generar Report ID único ===
export const makeGenerateReportID = ({ project, turbine }) =>
  () => {
    const parkName = String(project?.wind_farm || "PARK");
    const turbineName = String(turbine?.turbine_name || "TXX");
    const timestamp = Date.now().toString().slice(-6);

    // Solo permitir caracteres alfanuméricos, guiones y guiones bajos para evitar problemas en el sistema de archivos
    const cleanPark = parkName.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase();
    const cleanTurbine = turbineName
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toUpperCase();

    return `${cleanPark}-${cleanTurbine}-${timestamp}`;
  };

  // === Función auxiliar para agregar encabezado ===
export const makeAddHeader = ({ turbine, generateReportID }) =>
  (pdf, pageWidth, pageHeight, margin, t) => {
    pdf.setFillColor(248, 248, 248);
    pdf.rect(0, 0, pageWidth, 20, "F");

    const headerRightX = pageWidth - margin;
    const headerY = 8;

    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "bold");

    const reportDate = turbine?.inspection_date
      ? new Date(turbine.inspection_date).toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

    pdf.text(t("pdf.reportDate") + ":", headerRightX - 40, headerY);
    pdf.setFont("helvetica", "normal");
    pdf.text(reportDate, headerRightX - 40, headerY + 3);

    const reportID = generateReportID();
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.reportId") || "Report ID:", headerRightX - 40, headerY + 8);
    pdf.setFont("helvetica", "normal");
    pdf.text(reportID, headerRightX - 40, headerY + 11);

    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.line(0, 20, pageWidth, 20);
  };

  // === Función auxiliar para agregar footer ===
export const addFooter = async (pdf, pageWidth, pageHeight, margin, t) => {
    const footerAreaHeight = 18;
    pdf.setFillColor(248, 248, 248);
    pdf.rect(
      0,
      pageHeight - footerAreaHeight,
      pageWidth,
      footerAreaHeight,
      "F",
    );

    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.line(
      0,
      pageHeight - footerAreaHeight,
      pageWidth,
      pageHeight - footerAreaHeight,
    );

    try {
      const footerImg = new Image();
      footerImg.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        footerImg.onload = resolve;
        footerImg.onerror = reject;
        footerImg.src = "/icons/footer.png";
      });

      const canvas = document.createElement("canvas");
      canvas.width = footerImg.width;
      canvas.height = footerImg.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgb(248, 248, 248)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(footerImg, 0, 0);
      const footerDataUrl = canvas.toDataURL("image/jpeg", 0.8);

      const footerWidth = 35;
      const footerHeight = 8;
      const footerX = (pageWidth - footerWidth) / 2;
      const footerY = pageHeight - 15;

      pdf.addImage(footerDataUrl, "JPEG", footerX, footerY, footerWidth, footerHeight, "footerLogo", "FAST");

      pdf.setFontSize(6);
      pdf.setTextColor(80, 80, 80);

      const generatedDate = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      const leftText = `${t("reportViewer.generated")}: ${generatedDate}`;
      const rightText = `${t("reportViewer.platform")}: VND Blade Platform`;

      pdf.text(leftText, margin, pageHeight - 3);
      pdf.text(rightText, pageWidth - margin, pageHeight - 3, {
        align: "right",
      });
    } catch (error) {
      console.warn("No se pudo cargar el footer, usando fallback:", error);
      pdf.setFontSize(6);
      pdf.setTextColor(80, 80, 80);
      const generatedDate = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      pdf.text(
        `${t("reportViewer.generated")}: ${generatedDate} | ${t("reportViewer.platform")}: VND Blade Platform`,
        pageWidth / 2,
        pageHeight - 9,
        { align: "center" },
      );
    }
  };

  // === Función auxiliar para agregar página nueva ===
export const makeAddPageWithHeaderFooter = ({ addHeader }) =>
  async (
    pdf,
    pageWidth,
    pageHeight,
    margin,
    t,
  ) => {
    pdf.addPage();
    addHeader(pdf, pageWidth, pageHeight, margin, t);
    await addFooter(pdf, pageWidth, pageHeight, margin, t);
    return 35;
  };
