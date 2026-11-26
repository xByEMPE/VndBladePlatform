export const makeCreateClassificationPage = ({ addPageWithHeaderFooter }) =>
  async (
    pdf,
    pageWidth,
    pageHeight,
    margin,
    t,
  ) => {
    let currentY = 35;
    const footerSpace = 25;
    const maxY = pageHeight - footerSpace;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(`2.2 ${t("pdf.classificationOfAnnotations")}`, margin, currentY);
    currentY += 15;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.severity"), margin, currentY);
    pdf.text(t("pdf.description"), margin + 25, currentY);
    pdf.text(t("pdf.action"), margin + 105, currentY);
    currentY += 5;

    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    const classifications = [
      {
        cat: "Cat 1",
        desc: t("pdf.cat1Description"),
        action: t("pdf.cat1Action"),
        color: [0, 128, 0],
      },
      {
        cat: "Cat 2",
        desc: t("pdf.cat2Description"),
        action: t("pdf.cat2Action"),
        color: [0, 128, 0],
      },
      {
        cat: "Cat 3",
        desc: t("pdf.cat3Description"),
        action: t("pdf.cat3Action"),
        color: [255, 255, 0],
      },
      {
        cat: "Cat 4",
        desc: t("pdf.cat4Description"),
        action: t("pdf.cat4Action"),
        color: [255, 165, 0],
      },
      {
        cat: "Cat 5",
        desc: t("pdf.cat5Description"),
        action: t("pdf.cat5Action"),
        color: [255, 0, 0],
      },
    ];

    pdf.setFontSize(9);
    for (let i = 0; i < classifications.length; i++) {
      const item = classifications[i];

      if (currentY > maxY - 25) {
        currentY = await addPageWithHeaderFooter(
          pdf,
          pageWidth,
          pageHeight,
          margin,
          t,
        );
      }

      pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
      pdf.rect(margin, currentY - 3, 20, 8, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.text(item.cat, margin + 2, currentY + 2);

      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      const descText = pdf.splitTextToSize(item.desc, 75);
      pdf.text(descText, margin + 25, currentY);

      const actionText = pdf.splitTextToSize(item.action, 75);
      pdf.text(actionText, margin + 105, currentY);

      const maxLines = Math.max(descText.length, actionText.length);
      currentY += Math.max(15, maxLines * 4 + 5);
    }
  };
