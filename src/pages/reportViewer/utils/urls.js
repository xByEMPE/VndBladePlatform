import { getImageUrl } from "@/lib/storageUrls";
import { getThumbnailUrl } from "../../shared/image";

// URLs de las fotos para el carrusel (rutas http se usan tal cual)
export const getImageFullUrl = (file) =>
  file.path?.startsWith("http")
    ? file.path
    : getImageUrl(file.path);
export const getImageThumbUrl = (file) =>
  file.path?.startsWith("http") ? null : getThumbnailUrl(file.path);
