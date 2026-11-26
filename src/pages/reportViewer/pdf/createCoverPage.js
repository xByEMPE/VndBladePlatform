  // === Funciones para crear páginas del PDF ===
export const makeCreateCoverPage = ({ project, turbine, getCoordinatesDisplay }) =>
  async (pdf, pageWidth, pageHeight, margin, t) => {
    try {
      const mainImg = new Image();
      mainImg.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        mainImg.onload = resolve;
        mainImg.onerror = reject;
        mainImg.src = "/icons/main.png";
      });

      const canvas = document.createElement("canvas");
      canvas.width = mainImg.width;
      canvas.height = mainImg.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(mainImg, 0, 0);
      const mainDataUrl = canvas.toDataURL("image/jpeg", 0.7);
      pdf.addImage(mainDataUrl, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
    } catch (error) {
      console.warn(
        "No se pudo cargar main.png, usando fondo por defecto:",
        error,
      );
      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("VINDGROUP", margin, 40);

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "normal");
      pdf.text(t("pdf.inspectionReport"), margin, 55);
    }

    const tableY = 180;
    pdf.setFillColor(55, 65, 81);
    pdf.rect(margin, tableY, pageWidth - margin * 2, 60, "F");

    pdf.setDrawColor(107, 114, 128);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, tableY, pageWidth - margin * 2, 60);

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");

    const leftColX = margin + 5;
    const rightColX = pageWidth / 2;
    let currentY = tableY + 15;
    const rowHeight = 8;

    pdf.text(t("pdf.windPark"), leftColX, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.text(project?.wind_farm || "N/A", leftColX + 30, currentY);

    currentY += rowHeight;
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.windTurbine"), leftColX, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.text(turbine?.turbine_name || "N/A", leftColX + 30, currentY);

    currentY += rowHeight;
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.blades"), leftColX, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      t("reportViewer.allBlades") || "All Blades (A, B, C)",
      leftColX + 30,
      currentY,
    );

    currentY = tableY + 15;
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.wtgCoord"), rightColX, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.text(getCoordinatesDisplay(turbine?.coordinates) || "N/A", rightColX + 30, currentY);

    currentY += rowHeight;
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.model"), rightColX, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.text(turbine?.model || "N/A", rightColX + 30, currentY);

    currentY += rowHeight;
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.inspectionDate"), rightColX, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      turbine?.inspection_date
        ? new Date(turbine.inspection_date).toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
        : "N/A",
      rightColX + 40,
      currentY,
    );

    const noticeY = 250;
    pdf.setFillColor(220, 38, 38, 0.2);
    pdf.rect(margin, noticeY, pageWidth - margin * 2, 35, "F");

    pdf.setDrawColor(220, 38, 38);
    pdf.rect(margin, noticeY, pageWidth - margin * 2, 35);

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.confidentialityNotice"), margin + 2, noticeY + 8);

    pdf.setFont("helvetica", "normal");
    const noticeText = t("pdf.confidentialityText");

    const splitText = pdf.splitTextToSize(
      noticeText,
      pageWidth - margin * 2 - 4,
    );
    pdf.text(splitText, margin + 2, noticeY + 15);
  };
