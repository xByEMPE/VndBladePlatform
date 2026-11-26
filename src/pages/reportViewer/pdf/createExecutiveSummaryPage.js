export const makeCreateExecutiveSummaryPage = ({ turbine, project, addPageWithHeaderFooter }) =>
  async (
    pdf,
    pageWidth,
    pageHeight,
    margin,
    t,
    reportDamages,
  ) => {
    let currentY = 35;
    const footerSpace = 25;
    const maxY = pageHeight - footerSpace;

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.text(`1. ${t("pdf.executiveSummary")}`, margin, currentY);
    currentY += 20;

    // Información general del proyecto
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.projectOverview"), margin, currentY);
    currentY += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const projectOverview = t("pdf.projectOverviewText", {
      turbineName: turbine?.turbine_name || "TXX",
      windFarm: project?.wind_farm || "N/A",
      projectName: project?.name || "N/A",
      inspectionDate: turbine?.inspection_date
        ? new Date(turbine.inspection_date).toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })
        : "N/A",
    });

    const splitOverview = pdf.splitTextToSize(
      projectOverview,
      pageWidth - margin * 2,
    );
    pdf.text(splitOverview, margin, currentY);
    currentY += splitOverview.length * 5 + 10;

    // Resumen de hallazgos
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.keyFindings"), margin, currentY);
    currentY += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const totalDamages = reportDamages.length;
    const getSev = (s) => {
      if (!s) return 0;
      const match = s.toString().match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    const severityCounts = {
      "Cat 1": reportDamages.filter((d) => getSev(d.severity) === 1).length,
      "Cat 2": reportDamages.filter((d) => getSev(d.severity) === 2).length,
      "Cat 3": reportDamages.filter((d) => getSev(d.severity) === 3).length,
      "Cat 4": reportDamages.filter((d) => getSev(d.severity) === 4).length,
      "Cat 5": reportDamages.filter((d) => getSev(d.severity) === 5).length,
    };

    const keyFindings = [
      `• ${t("pdf.totalDamagesFound", { count: totalDamages })}`,
      "",
      t("pdf.distributionBySeverity"),
      `  - ${t("pdf.category1Minor", {
        count: severityCounts["Cat 1"],
      })}`,
      `  - ${t("pdf.category2Light", {
        count: severityCounts["Cat 2"],
      })}`,
      `  - ${t("pdf.category3Moderate", {
        count: severityCounts["Cat 3"],
      })}`,
      `  - ${t("pdf.category4Severe", {
        count: severityCounts["Cat 4"],
      })}`,
      `  - ${t("pdf.category5Critical", {
        count: severityCounts["Cat 5"],
      })}`,
    ];

    for (const finding of keyFindings) {
      if (currentY > maxY - 10) {
        currentY = await addPageWithHeaderFooter(
          pdf,
          pageWidth,
          pageHeight,
          margin,
          t,
        );
      }
      pdf.text(finding, margin, currentY);
      currentY += 5;
    }

    currentY += 10;

    // Distribución por pala
    if (currentY > maxY - 50) {
      currentY = await addPageWithHeaderFooter(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        t,
      );
    }

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.bladeDistribution") + ":", margin, currentY);
    currentY += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const bladeNames = ["Blade A", "Blade B", "Blade C"];
    bladeNames.forEach(async (bladeName) => {
      // Filter and Sort by Severity (High to Low)
      const bladeDamages = reportDamages
        .filter((d) => d.blade === bladeName)
        .sort((a, b) => {
          const sevA =
            parseInt(String(a.severity || "").replace(/\D/g, "")) || 0;
          const sevB =
            parseInt(String(b.severity || "").replace(/\D/g, "")) || 0;
          return sevB - sevA; // Descending order (5 -> 1)
        });

      if (bladeDamages.length > 0) {
        const mostSevere = bladeDamages.reduce((max, damage) => {
          const currentSev = parseInt(
            damage.severity.toString().match(/\d+/)?.[0] || 0,
          );
          const maxSev = parseInt(
            max.severity.toString().match(/\d+/)?.[0] || 0,
          );
          return currentSev > maxSev ? damage : max;
        });

        const distributionText = t("pdf.bladeDistributionText", {
          bladeName: bladeName,
          count: bladeDamages.length,
          severity: mostSevere.severity,
        });
        pdf.text(`• ${distributionText}`, margin, currentY);
        currentY += 5;
      } else {
        const noDamagesText = t("pdf.noDamagesInBlade", {
          bladeName: bladeName,
        });
        pdf.text(`• ${noDamagesText}`, margin, currentY);
        currentY += 5;
      }
    });

    currentY += 10;

    // Recomendaciones principales
    if (currentY > maxY - 40) {
      currentY = await addPageWithHeaderFooter(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        t,
      );
    }

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.mainRecommendations") + ":", margin, currentY);
    currentY += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    let recommendations = [];

    if (severityCounts["Cat 5"] > 0) {
      recommendations.push(`• ${t("pdf.immediateAction")}`);
    }
    if (severityCounts["Cat 4"] > 0) {
      recommendations.push(`• ${t("pdf.highPriority")}`);
    }
    if (severityCounts["Cat 3"] > 0) {
      recommendations.push(`• ${t("pdf.mediumPriority")}`);
    }
    if (totalDamages === 0) {
      recommendations.push(`• ${t("pdf.excellentCondition")}`);
    }

    recommendations.push(`• ${t("pdf.continueInspections")}`);
    recommendations.push(`• ${t("pdf.reviewDetailedReport")}`);

    for (const rec of recommendations) {
      if (currentY > maxY - 10) {
        currentY = await addPageWithHeaderFooter(
          pdf,
          pageWidth,
          pageHeight,
          margin,
          t,
        );
      }
      const splitRec = pdf.splitTextToSize(rec, pageWidth - margin * 2);
      pdf.text(splitRec, margin, currentY);
      currentY += splitRec.length * 5 + 2;
    }
  };
