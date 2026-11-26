import { toast } from "@/components/ui/use-toast";
import { addFooter } from "./pdfLayout";
import { createContentsPage } from "./createContentsPage";
import { makeGenerateReportID, makeAddHeader, makeAddPageWithHeaderFooter } from "./pdfLayout";
import { makeCreateCoverPage } from "./createCoverPage";
import { makeCreateExecutiveSummaryPage } from "./createExecutiveSummaryPage";
import { makeCreateGlossaryPage } from "./createGlossaryPage";
import { makeCreateClassificationPage } from "./createClassificationPage";
import { makeCreateIntroductionPage } from "./createIntroductionPage";
import { makeCreateInspectionResultsPage } from "./createInspectionResultsPage";
import { makeCreateInspectionRecommendationsPage } from "./createInspectionRecommendationsPage";

  // === Exportar PDF ===
export const makeGeneratePDF = ({ isGeneratingPDF, setIsGeneratingPDF, setShowPdfDialog, i18n, t, isAdmin, selectedDamages, damages, damageImages, loadDamageImages, createCoverPage, addHeader, createExecutiveSummaryPage, createGlossaryPage, createClassificationPage, createIntroductionPage, createInspectionResultsPage, createInspectionRecommendationsPage, generateReportID }) =>
  async (languageCode) => {
    if (isGeneratingPDF) return;

    setIsGeneratingPDF(true);
    setShowPdfDialog(false); // Close dialog if open

    const exportId = Date.now();

    try {
      const jspdfModule = await import("jspdf");
      const jsPDF = jspdfModule.jsPDF || jspdfModule.default;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;

      console.time(`[PDF] export-${exportId}`);
      console.log("[PDF] Iniciando generación...");

      // Obtener función de traducción para el idioma seleccionado
      // (namespace 'reports' contiene las claves 'pdf.*')
      const tPdf = i18n.getFixedT(languageCode, ["reports", "common"]);

      toast({
        title: t("reportViewer.generatingPdf"),
        description: t("reportViewer.pleaseWait"),
      });

      // Si hay daños seleccionados manualmente y el usuario es Admin, filtrar; si no, usar todos
      const damagesToPrint =
        isAdmin && selectedDamages.size > 0
          ? damages.filter((d) => selectedDamages.has(d.id))
          : damages;

      if (!damageImages || Object.keys(damageImages).length === 0) {
        try {
          await loadDamageImages();
        } catch (_) {}
      }

      const pageTracker = {}; // NUEVO OBJETO RASTREADOR

      await createCoverPage(pdf, pageWidth, pageHeight, margin, tPdf);

      console.log("[PDF] Contents reserved");
      pdf.addPage();
      const tocPageNumber = pdf.internal.getNumberOfPages();
      addHeader(pdf, pageWidth, pageHeight, margin, tPdf);
      await addFooter(pdf, pageWidth, pageHeight, margin, tPdf);

      console.log("[PDF] Executive Summary");
      pdf.addPage();
      pageTracker.execSummary = pdf.internal.getNumberOfPages();
      addHeader(pdf, pageWidth, pageHeight, margin, tPdf);
      await createExecutiveSummaryPage(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        tPdf,
        damagesToPrint,
      );
      await addFooter(pdf, pageWidth, pageHeight, margin, tPdf);

      console.log("[PDF] Glossary");
      pdf.addPage();
      pageTracker.glossary = pdf.internal.getNumberOfPages();
      addHeader(pdf, pageWidth, pageHeight, margin, tPdf);
      await createGlossaryPage(pdf, pageWidth, pageHeight, margin, tPdf);
      await addFooter(pdf, pageWidth, pageHeight, margin, tPdf);

      console.log("[PDF] Classification");
      pdf.addPage();
      pageTracker.glossaryClassification = pdf.internal.getNumberOfPages();
      addHeader(pdf, pageWidth, pageHeight, margin, tPdf);
      await createClassificationPage(pdf, pageWidth, pageHeight, margin, tPdf);
      await addFooter(pdf, pageWidth, pageHeight, margin, tPdf);

      console.log("[PDF] Introduction");
      pdf.addPage();
      pageTracker.intro = pdf.internal.getNumberOfPages();
      addHeader(pdf, pageWidth, pageHeight, margin, tPdf);
      await addFooter(pdf, pageWidth, pageHeight, margin, tPdf);
      const introEndY = await createIntroductionPage(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        tPdf,
        damagesToPrint,
        pageTracker,
      );

      console.log("[PDF] Inspection Results");
      pageTracker.results = pdf.internal.getNumberOfPages();
      const resultsEndY = await createInspectionResultsPage(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        tPdf,
        damagesToPrint,
        pageTracker,
        introEndY,
        languageCode,
      );

      console.log("[PDF] Inspection Recommendations");
      pageTracker.recommendations = pdf.internal.getNumberOfPages();
      await createInspectionRecommendationsPage(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        tPdf,
        damagesToPrint,
        resultsEndY,
      );

      console.log("[PDF] Drawing exact Contents");
      pdf.setPage(tocPageNumber);
      await createContentsPage(
        pdf,
        pageWidth,
        pageHeight,
        margin,
        tPdf,
        pageTracker,
        damagesToPrint.length > 0,
      );

      const reportID = generateReportID();
      const fileName = `Inspection_Report_${reportID}.pdf`;

      console.log("[PDF] Guardando...");
      pdf.save(fileName);
      console.timeEnd(`[PDF] export-${exportId}`);

      toast({
        title: t("reportViewer.pdfExported"),
        description: t("reportViewer.pdfExportedDescription"),
      });
    } catch (e) {
      console.error("[PDF] Error exportando PDF:", e);
      try {
        const jspdfModule = await import("jspdf");
        const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
        const fallback = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });
        fallback.text("PDF generation failed. Please retry.", 20, 20);
        fallback.save("report-error.pdf");
      } catch (_) {}

      toast({
        title: t("reportViewer.pdfExportError"),
        description: e?.message || t("reportViewer.pdfExportErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

// Cablea las fábricas del PDF con el estado del render actual y devuelve generatePDF.
// Se llama en cada render (igual que las funciones originales dentro del componente).
export const createReportPdf = ({ project, turbine, getCoordinatesDisplay, totalImages, totalImagesByBlade, damageImages, i18n, isGeneratingPDF, setIsGeneratingPDF, setShowPdfDialog, t, isAdmin, selectedDamages, damages, loadDamageImages }) => {
  const generateReportID = makeGenerateReportID({ project, turbine });
  const addHeader = makeAddHeader({ turbine, generateReportID });
  const addPageWithHeaderFooter = makeAddPageWithHeaderFooter({ addHeader });
  const createCoverPage = makeCreateCoverPage({ project, turbine, getCoordinatesDisplay });
  const createExecutiveSummaryPage = makeCreateExecutiveSummaryPage({ turbine, project, addPageWithHeaderFooter });
  const createGlossaryPage = makeCreateGlossaryPage({ addPageWithHeaderFooter });
  const createClassificationPage = makeCreateClassificationPage({ addPageWithHeaderFooter });
  const createIntroductionPage = makeCreateIntroductionPage({ turbine, project, totalImages, totalImagesByBlade, getCoordinatesDisplay, addPageWithHeaderFooter });
  const createInspectionResultsPage = makeCreateInspectionResultsPage({ addPageWithHeaderFooter, turbine, damageImages, i18n, project });
  const createInspectionRecommendationsPage = makeCreateInspectionRecommendationsPage({ addPageWithHeaderFooter });
  const generatePDF = makeGeneratePDF({ isGeneratingPDF, setIsGeneratingPDF, setShowPdfDialog, i18n, t, isAdmin, selectedDamages, damages, damageImages, loadDamageImages, createCoverPage, addHeader, createExecutiveSummaryPage, createGlossaryPage, createClassificationPage, createIntroductionPage, createInspectionResultsPage, createInspectionRecommendationsPage, generateReportID });
  return { generatePDF };
};
