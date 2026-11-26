import { getImageUrl } from "@/lib/storageUrls";

export const getThumbnailUrl = (originalPath) => {
  if (!originalPath) return null;
  const parts = originalPath.split("/");
  const fileName = parts.pop();
  if (!fileName) return null;
  const folder = parts.join("/");

  // Construct path to potential thumbnail file
  // Assumes structure: .../folder/thumbnails/filename.webp (WEBP format)
  const thumbFileName = fileName.replace(/\.[^/.]+$/, ".webp");
  const thumbPath = folder
    ? `${folder}/thumbnails/${thumbFileName}`
    : `thumbnails/${thumbFileName}`;

  // Supabase getPublicUrl is synchronous string generation
  const data = { publicUrl: getImageUrl(thumbPath) };
  return data.publicUrl;
};

// Alias de retrocompatibilidad (nombre usado por DamageEditorPage)
export const getThumbPublicUrl = getThumbnailUrl;
