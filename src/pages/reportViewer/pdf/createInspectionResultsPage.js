import { primeLongLivedUrls, getImageUrl, getLongLivedUrl } from "@/lib/storageUrls";
import { getDamageExtraData, getDamageBboxData, hexToRgb, getLocalizedDamageString } from "../../shared/damage";
import { drawBladeSvgWithDot } from "./bladeSvg";
import { translateAdditionalNotes } from "../../../utils/translationUtils";
import { cropImageFromBbox, addBboxToImage } from "../../shared/image";
import { getSeverityColorForPDF } from "./severityColor";
import { imageToBase64 } from "./imageToBase64";

export const makeCreateInspectionResultsPage = ({ addPageWithHeaderFooter, turbine, damageImages, i18n, project }) =>
  async (
    pdf,
    pageWidth,
    pageHeight,
    margin,
    t,
    reportDamages,
    pageTracker,
    startY = 35,
    languageCode,
  ) => {
    // Enlaces del PDF: firmados a 3 meses y en lote (una petición por cada 200 rutas)
    await primeLongLivedUrls(
      (reportDamages || []).flatMap((d) => {
        let manual = null;
        try {
          manual = d?.description ? JSON.parse(d.description).image_path : null;
        } catch (e) {}
        return [d?.capture_storage_path, manual];
      }),
    );

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
      if (pageTracker) pageTracker.results = pdf.internal.getNumberOfPages();
    } else if (currentY > 35) {
      currentY += 15;
      if (pageTracker) pageTracker.results = pdf.internal.getNumberOfPages();
    }

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(`4. ${t("pdf.inspectionResults")}`, margin, currentY);
    currentY += 15;

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`4.1 ${t("pdf.overallSummary")}`, margin, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const totalDamages = reportDamages.length;
    const aiDetectedDamages = reportDamages.filter(
      (d) => d.auto_detected,
    ).length;

    const summaryText = t("pdf.inspectionSummary", {
      count: totalDamages,
      turbineName: turbine?.turbine_name || "TXX",
    });
    const splitSummaryText = pdf.splitTextToSize(
      summaryText,
      pageWidth - margin * 2,
    );
    pdf.text(splitSummaryText, margin, currentY);
    currentY += splitSummaryText.length * 5 + 10;

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`4.2 ${t("pdf.damageDistribution")}`, margin, currentY);
    currentY += 12;

    const bladeNames = ["Blade A", "Blade B", "Blade C"];

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("pdf.blade"), margin, currentY);
    pdf.text(t("pdf.totalDamages"), margin + 50, currentY);
    currentY += 5;

    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, margin + 120, currentY);
    currentY += 8;

    bladeNames.forEach((bladeName) => {
      const bladeDamagesCount = reportDamages.filter(
        (d) => d.blade === bladeName,
      ).length;
      pdf.setFont("helvetica", "normal");
      pdf.text(bladeName, margin, currentY);
      pdf.text(bladeDamagesCount.toString(), margin + 50, currentY);
      currentY += 8;
    });

    currentY += 10;

    if (reportDamages.length > 0) {
      if (currentY > maxY - 30) {
        currentY = await addPageWithHeaderFooter(
          pdf,
          pageWidth,
          pageHeight,
          margin,
          t,
        );
      }

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(`4.3 ${t("pdf.detailedDamageInformation")}`, margin, currentY);
      currentY += 12;

      const sortBySeverityDesc = (list) => {
        return [...list].sort((a, b) => {
          const sevA =
            parseInt(String(a.severity || "").replace(/\D/g, "")) || 0;
          const sevB =
            parseInt(String(b.severity || "").replace(/\D/g, "")) || 0;
          return sevB - sevA;
        });
      };

      const damagesByBlade = {
        "Blade A": sortBySeverityDesc(
          reportDamages.filter((d) => d.blade === "Blade A"),
        ),
        "Blade B": sortBySeverityDesc(
          reportDamages.filter((d) => d.blade === "Blade B"),
        ),
        "Blade C": sortBySeverityDesc(
          reportDamages.filter((d) => d.blade === "Blade C"),
        ),
      };

      for (const [bladeName, bladeDamages] of Object.entries(damagesByBlade)) {
        if (bladeDamages.length > 0) {
          let minimumSpaceNeeded = 25;

          if (bladeDamages.length > 0) {
            const firstDamage = bladeDamages[0];
            const firstExtraData = getDamageExtraData(firstDamage);
            let firstDamageSpace = 15;
            let tableRows = 2;
            if (firstExtraData.damage_type) tableRows++;
            if (firstExtraData.radius_mm) tableRows++;
            if (firstExtraData.length_mm) tableRows++;
            if (firstExtraData.width_mm) tableRows++;
            firstDamageSpace += tableRows * 7 + 5;

            const firstBladeNameForSearch = bladeName.replace(
              "Blade ",
              "Pala ",
            );
            const firstDamageImageInfo = Object.entries(damageImages).find(
              ([imageKey, info]) => {
                const keyMatches = imageKey.includes(
                  `_${firstDamage.section}_${firstBladeNameForSearch}`,
                );
                const sectionMatches = info.section === firstDamage.section;
                const bladeMatches = info.blade === firstBladeNameForSearch;
                return keyMatches && sectionMatches && bladeMatches;
              },
            );

            if (firstDamageImageInfo) {
              firstDamageSpace += 110;
            }

            minimumSpaceNeeded += firstDamageSpace;
          }

          if (currentY > maxY - minimumSpaceNeeded) {
            currentY = await addPageWithHeaderFooter(
              pdf,
              pageWidth,
              pageHeight,
              margin,
              t,
            );
          }

          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.text(
            `${bladeName} - ${bladeDamages.length} ${t("pdf.detectedDamages")}`,
            margin,
            currentY,
          );
          currentY += 10;

          for (const [index, damage] of bladeDamages.entries()) {
            const extraData = getDamageExtraData(damage);
            const bladeNameForSearch = bladeName.replace("Blade ", "Pala ");

            let damageImageInfo = null;
            if (damage.description) {
              try {
                const desc = JSON.parse(damage.description);
                if (desc.image_path) {
                  damageImageInfo = [
                    null,
                    {
                      originalPath: desc.image_path,
                      imageName: desc.image_name || `damage_${damage.id}.jpg`,
                      section: damage.section,
                      blade: bladeNameForSearch,
                      inspection_file_id: desc.inspection_file_id,
                    },
                  ];
                }
              } catch (e) {}
            }

            if (!damageImageInfo && damage.capture_storage_path) {
              damageImageInfo = [
                null,
                {
                  originalPath: damage.capture_storage_path,
                  imageName: damage.capture_storage_path.split("/").pop(),
                  section: damage.section,
                  blade: bladeNameForSearch,
                  inspection_file_id: damage.capture_id,
                },
              ];
            }

            if (!damageImageInfo) {
              damageImageInfo = Object.entries(damageImages).find(
                ([imageKey, info]) => {
                  const keyMatches =
                    imageKey.includes(
                      `_${damage.section}_${bladeNameForSearch}`,
                    ) || imageKey.includes(`_${damage.section}_${bladeName}`);
                  const sectionMatches = info.section === damage.section;
                  const bladeMatches =
                    info.blade === bladeNameForSearch ||
                    info.blade === bladeName;
                  const isAutoDetected =
                    damage.title && damage.title.includes("Auto");
                  const hasDetections =
                    info.detections && info.detections.length > 0;
                  return (
                    (keyMatches && sectionMatches && bladeMatches) ||
                    (isAutoDetected &&
                      sectionMatches &&
                      bladeMatches &&
                      hasDetections)
                  );
                },
              );
            }

            const imageInfo = damageImageInfo ? damageImageInfo[1] : null;
            const hasImage = imageInfo && imageInfo.originalPath;

            let estimatedHeight = 0;
            estimatedHeight += 10;

            let tableRows = 2;
            if (extraData.damage_type) tableRows++;
            if (extraData.radius_mm) tableRows++;
            if (extraData.length_mm) tableRows++;
            if (extraData.width_mm) tableRows++;

            estimatedHeight += tableRows * 7 + 5;

            if (extraData.additional_notes) {
              const noteLines = Math.ceil(
                extraData.additional_notes.length / 80,
              );
              estimatedHeight += noteLines * 5 + 8;
            }

            if (hasImage) {
              estimatedHeight += 5;
              const bboxData = getDamageBboxData(damage);
              if (bboxData && bboxData.bbox_xywh_norm) {
                estimatedHeight += 95;
                estimatedHeight += 15;
              } else {
                estimatedHeight += 95;
                estimatedHeight += 15;
              }
            }

            estimatedHeight += 15;

            if (currentY + estimatedHeight > maxY) {
              currentY = await addPageWithHeaderFooter(
                pdf,
                pageWidth,
                pageHeight,
                margin,
                t,
              );
            }

            const cardX = margin;
            const cardW = pageWidth - margin * 2;
            const headerH = 10;

            const sevColorHex =
              getSeverityColorForPDF(damage.severity) || "#FFFF00";
            const sevRgb = hexToRgb(sevColorHex);

            pdf.setFillColor(sevRgb.r, sevRgb.g, sevRgb.b);
            pdf.rect(cardX, currentY, cardW, headerH, "F");

            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(0, 0, 0);

            const bladeBasedDamageIndex = bladeDamages
              ? bladeDamages.findIndex((d) => d.id === damage.id) + 1
              : index + 1;
            const damageLabelPrefix = `${t("pdf.damage")} #${bladeBasedDamageIndex}`;

            const rawTitle = damage.title || "";
            const isGenericTitle =
              !rawTitle ||
              rawTitle.toLowerCase() === "daño" ||
              rawTitle.toLowerCase() === "damage" ||
              rawTitle.startsWith("Auto");
            const fullHeaderText = isGenericTitle
              ? damageLabelPrefix
              : `${damageLabelPrefix} - ${rawTitle}`;

            const titleMaxW = cardW - 8;
            const titleLines = pdf.splitTextToSize(fullHeaderText, titleMaxW);
            pdf.text(titleLines[0], cardX + 4, currentY + headerH * 0.65);
            currentY += headerH + 3;

            const fullTextWidth = pageWidth - margin * 2 - 10;

            const sevBarLabelW = 30;
            const sevBarTotalW = cardW - sevBarLabelW - 4;
            const sevBarH = 6;
            const sevBarX = cardX + sevBarLabelW + 2;

            pdf.setFontSize(8);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(60, 60, 60);
            pdf.text(
              t("pdf.severity") || "Severity",
              cardX,
              currentY + sevBarH * 0.72,
            );

            pdf.setFillColor(220, 220, 220);
            pdf.rect(sevBarX, currentY, sevBarTotalW, sevBarH, "F");

            const catMatch = String(damage.severity || "").match(/\d+/);
            const sevLevel = catMatch ? parseInt(catMatch[0], 10) : 3;
            const totalLevels = 5;
            const segmentW = sevBarTotalW / totalLevels;

            for (let i = 0; i < totalLevels; i++) {
              if (i < sevLevel) {
                pdf.setFillColor(sevRgb.r, sevRgb.g, sevRgb.b);
              } else {
                pdf.setFillColor(220, 220, 220);
              }
              pdf.rect(
                sevBarX + i * segmentW,
                currentY,
                segmentW,
                sevBarH,
                "F",
              );
              pdf.setDrawColor(255, 255, 255);
              pdf.setLineWidth(0.5);
              pdf.rect(sevBarX + i * segmentW, currentY, segmentW, sevBarH);
            }

            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(0.3);
            pdf.rect(sevBarX, currentY, sevBarTotalW, sevBarH);

            pdf.setFontSize(7.5);
            pdf.setFont("helvetica", "bold");
            if (sevLevel === 3) {
              pdf.setTextColor(60, 60, 60);
            } else {
              pdf.setTextColor(255, 255, 255);
            }
            const textX = sevBarX + (sevLevel - 1) * segmentW + segmentW / 2;
            pdf.text(String(sevLevel), textX, currentY + sevBarH * 0.75, {
              align: "center",
            });

            currentY += sevBarH + 5;

            pdf.setFontSize(10);
            pdf.setFont("helvetica", "normal");

            const formattedBladeName = bladeName.replace(
              "Blade",
              t("pdf.blade") || "Blade",
            );
            const tableData = [
              [
                t("pdf.section"),
                `${formattedBladeName}, ${t("pdf.section")} ${damage.section}`,
              ],
            ];

            if (extraData.damage_type) {
              const dt = extraData.damage_type;
              let pt = dt;
              if (dt.includes(" - ")) {
                pt = `${getLocalizedDamageString(dt.split(" - ")[0], i18n)} - ${getLocalizedDamageString(dt.split(" - ")[1], i18n)}`;
              } else {
                pt = getLocalizedDamageString(dt, i18n);
              }
              tableData.push([t("pdf.type"), pt]);
            }

            if (extraData.radius_mm)
              tableData.push([t("pdf.radius"), `${extraData.radius_mm}mm`]);
            if (extraData.length_mm)
              tableData.push([t("pdf.length"), `${extraData.length_mm}mm`]);
            if (extraData.width_mm)
              tableData.push([t("pdf.width"), `${extraData.width_mm}mm`]);

            const tableX = cardX;
            const colWidth1 = 55;
            const colWidth2 = cardW - colWidth1;
            const baseRowHeight = 7;

            pdf.setFontSize(8.5);
            pdf.setLineWidth(0.3);

            const processedRows = tableData.map((row) => {
              const splitValue = pdf.splitTextToSize(
                String(row[1] || ""),
                colWidth2 - 6,
              );
              const calculatedHeight = Math.max(
                baseRowHeight,
                splitValue.length * 4.5 + 2.5,
              );
              return {
                label: String(row[0] || ""),
                valueSplit: splitValue,
                height: calculatedHeight,
              };
            });

            processedRows.forEach((row, rowIndex) => {
              if (rowIndex % 2 === 0) {
                pdf.setFillColor(247, 247, 247);
                pdf.rect(
                  tableX,
                  currentY,
                  colWidth1 + colWidth2,
                  row.height,
                  "F",
                );
              }
              pdf.setDrawColor(215, 215, 215);
              pdf.rect(tableX, currentY, colWidth1, row.height);
              pdf.rect(tableX + colWidth1, currentY, colWidth2, row.height);

              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(70, 70, 70);
              const labelY = currentY + row.height / 2 + 1.5;
              pdf.text(row.label, tableX + 3, labelY);

              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(0, 0, 0);
              const textBlockHeight = row.valueSplit.length * 4.5;
              const valueStartY =
                currentY + (row.height - textBlockHeight) / 2 + 3.5;
              pdf.text(row.valueSplit, tableX + colWidth1 + 3, valueStartY);

              currentY += row.height;
            });

            currentY += 5;

            if (extraData.radius_mm) {
              const radiusMeters = parseFloat(extraData.radius_mm) / 1000;
              const bladeLen =
                turbine?.blade_length || project?.blade_length || 50;
              const bladePngDataUrl = await drawBladeSvgWithDot(
                radiusMeters,
                bladeLen,
                sevColorHex,
              );
              if (bladePngDataUrl) {
                const bladeImgW = cardW * 0.85;
                const bladeImgH = bladeImgW * (160 / 600);
                const bladeImgX = cardX + (cardW - bladeImgW) / 2;
                pdf.addImage(
                  bladePngDataUrl,
                  "JPEG",
                  bladeImgX,
                  currentY,
                  bladeImgW,
                  bladeImgH,
                  undefined,
                  "FAST",
                );
                pdf.setFontSize(7.5);
                pdf.setFont("helvetica", "italic");
                pdf.setTextColor(100, 100, 100);
                const radiusLabelStr = `${t("pdf.radius") || "Radius"}: ${extraData.radius_mm}mm (${radiusMeters.toFixed(1)}m)`;
                pdf.text(
                  radiusLabelStr,
                  cardX + cardW / 2,
                  currentY + bladeImgH + 4,
                  { align: "center" },
                );
                currentY += bladeImgH + 10;
              }
            }

            if (extraData.additional_notes) {
              const translatedNotes = await translateAdditionalNotes(
                extraData.additional_notes,
                languageCode,
              );
              pdf.setFontSize(9);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(60, 60, 60);
              pdf.text(
                (t("pdf.notes") || "Notas") + ":",
                margin + 10,
                currentY,
              );
              currentY += 5;
              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(0, 0, 0);
              const notesLines = pdf.splitTextToSize(
                translatedNotes,
                fullTextWidth - 10,
              );
              pdf.text(notesLines, margin + 10, currentY);
              currentY += notesLines.length * 5 + 3;
            }

            if (hasImage) {
              currentY += 5;
              try {
                const imageUrl = getImageUrl(imageInfo.originalPath);
                const imageBase64 = await imageToBase64(imageUrl, 800, 0.7);

                if (imageBase64) {
                  const bboxData = getDamageBboxData(damage);
                  if (bboxData && bboxData.bbox_xywh_norm) {
                    const cropResult = await cropImageFromBbox(
                  imageUrl,
                  bboxData.bbox_xywh_norm,
                );
                if (cropResult && cropResult.dataUrl) {
                  const croppedImageBase64 = cropResult.dataUrl;
                  const aspectRatio = cropResult.aspectRatio || 1;

                  // Calculamos dimensiones dinámicas manteniendo la proporción
                  const maxBoxSize = 95; // El espacio cuadrado máximo permitido
                  let cropWidth, cropHeight;

                  if (aspectRatio > 1) {
                    // Imagen más ancha que alta
                    cropWidth = maxBoxSize;
                    cropHeight = maxBoxSize / aspectRatio;
                  } else {
                    // Imagen más alta que ancha
                    cropHeight = maxBoxSize;
                    cropWidth = maxBoxSize * aspectRatio;
                  }

                  // La imagen miniatura original de la derecha se mantiene constante
                  const smallImageWidth = 65;
                  const smallImageHeight = 50;

                  const gap = 10;
                  const sideMargin = 10;

                  // Ajustamos el centrado basado en las dimensiones reales calculadas
                  const totalRequiredWidth = cropWidth + gap + smallImageWidth;
                  const availableWidth = pageWidth - margin * 2 - sideMargin * 2;

                  const startX = margin + sideMargin + Math.max(0, (availableWidth - totalRequiredWidth) / 2);
                  const cropX = startX;
                  const smallImageX = startX + cropWidth + gap;

                  // Centramos verticalmente ambas imágenes en base a la altura máxima (maxBoxSize)
                  const blockCenterY = currentY + (maxBoxSize / 2);
                  const cropY = blockCenterY - (cropHeight / 2);
                  const smallImageY = blockCenterY - (smallImageHeight / 2);

                  pdf.addImage(
                    croppedImageBase64,
                    "JPEG",
                    cropX,
                    cropY, // Usamos la nueva Y centrada
                    cropWidth,
                    cropHeight,
                    undefined,
                    "FAST",
                  );

                  const imageWithBbox = await addBboxToImage(
                    imageUrl,
                    bboxData.bbox_xywh_norm,
                    300,
                    0.8,
                    damage.severity,
                  );

                  if (imageWithBbox) {
                    pdf.addImage(
                      imageWithBbox,
                      "JPEG",
                      smallImageX,
                      smallImageY, // Usamos la nueva Y centrada
                      smallImageWidth,
                      smallImageHeight,
                      undefined,
                      "FAST",
                    );
                  } else {
                    pdf.addImage(
                      imageBase64,
                      "JPEG",
                      smallImageX,
                      smallImageY, // Usamos la nueva Y centrada
                      smallImageWidth,
                      smallImageHeight,
                      undefined,
                      "FAST",
                    );
                  }

                  // Centramos el texto "Ver imagen completa" bajo el bloque completo
                  const centerX = startX + totalRequiredWidth / 2;
                  const linkY = currentY + maxBoxSize + 8; // Alineado debajo de la zona máxima
                      pdf.setFontSize(8);
                      pdf.setTextColor(0, 0, 255);
                      pdf.setFont("helvetica", "normal");
                      pdf.text(t("pdf.viewFullImage"), centerX, linkY, {
                        align: "center",
                      });

                      const linkWidth = 35;
                      const linkHeight = 5;
                      const linkX = centerX - linkWidth / 2;
                      const linkYClickable = linkY - 3;

                      const directImageUrl = getLongLivedUrl(imageInfo.originalPath);
                      pdf.link(linkX, linkYClickable, linkWidth, linkHeight, {
                        url: directImageUrl,
                      });
                      pdf.setTextColor(0, 0, 0);
                      pdf.setFontSize(9);
                      pdf.setFont("helvetica", "normal");

                      currentY += cropHeight + 15;
                    } else {
                      let finalImage = imageBase64;
                      if (bboxData && bboxData.bbox_xywh_norm) {
                        const imageWithBboxFallback = await addBboxToImage(
                          imageUrl,
                          bboxData.bbox_xywh_norm,
                          600,
                          0.8,
                          damage.severity,
                        );
                        if (imageWithBboxFallback)
                          finalImage = imageWithBboxFallback;
                      }
                      const imageWidth = 140;
                      const imageHeight = 95;
                      const sideMargin = 30;
                      const availableWidth =
                        pageWidth - margin * 2 - sideMargin * 2;
                      const imageX =
                        margin + sideMargin + (availableWidth - imageWidth) / 2;

                      pdf.addImage(
                        finalImage,
                        "JPEG",
                        imageX,
                        currentY,
                        imageWidth,
                        imageHeight,
                        undefined,
                        "FAST",
                      );

                      const textX = imageX + imageWidth / 2;
                      pdf.setFontSize(8);
                      pdf.setTextColor(0, 0, 255);
                      pdf.text(
                        t("pdf.viewFullImage"),
                        textX,
                        currentY + imageHeight + 8,
                        { align: "center" },
                      );
                      const linkWidth = 40;
                      const linkHeight = 6;
                      const linkX = textX - linkWidth / 2;
                      const linkY = currentY + imageHeight + 5;
                      const directImageUrl = getLongLivedUrl(imageInfo.originalPath);
                      pdf.link(linkX, linkY, linkWidth, linkHeight, {
                        url: directImageUrl,
                      });
                      pdf.setTextColor(0, 0, 0);
                      pdf.setFontSize(9);
                      currentY += imageHeight + 15;
                    }
                  } else {
                    const imageWidth = 140;
                    const imageHeight = 95;
                    const sideMargin = 30;
                    const availableWidth =
                      pageWidth - margin * 2 - sideMargin * 2;
                    const imageX =
                      margin + sideMargin + (availableWidth - imageWidth) / 2;

                    pdf.addImage(
                      imageBase64,
                      "JPEG",
                      imageX,
                      currentY,
                      imageWidth,
                      imageHeight,
                      undefined,
                      "FAST",
                    );

                    const textX = imageX + imageWidth / 2;
                    pdf.setFontSize(8);
                    pdf.setTextColor(0, 0, 255);
                    pdf.text(
                      t("pdf.viewFullImage"),
                      textX,
                      currentY + imageHeight + 8,
                      { align: "center" },
                    );
                    const linkWidth = 40;
                    const linkHeight = 6;
                    const linkX = textX - linkWidth / 2;
                    const linkY = currentY + imageHeight + 5;
                    const directImageUrl = getLongLivedUrl(imageInfo.originalPath);
                    pdf.link(linkX, linkY, linkWidth, linkHeight, {
                      url: directImageUrl,
                    });
                    pdf.setTextColor(0, 0, 0);
                    pdf.setFontSize(9);
                    currentY += imageHeight + 15;
                  }
                }
              } catch (error) {
                console.warn(
                  `No se pudo cargar imagen para daño ${damage.id}:`,
                  error,
                );
              }
            }
          }
        }
      }
    }
    return currentY;
  };
