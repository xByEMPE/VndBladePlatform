// turbines.stitched puede venir como objeto o como texto JSON
export const parseStitched = (raw) => {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
};
