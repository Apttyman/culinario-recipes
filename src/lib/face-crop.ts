export type FaceBox = { x: number; y: number; width: number; height: number } | null | undefined;

/**
 * Compute background-position + background-size that crops a circular avatar
 * tightly around the detected face. Falls back to a generic top-biased crop
 * when no face_box is present (matches legacy behavior).
 */
export function getFaceCropStyle(faceBox: FaceBox, avatarSize = 96): React.CSSProperties {
  if (!faceBox || typeof faceBox.x !== "number" || typeof faceBox.width !== "number") {
    return { backgroundPosition: "center 22%", backgroundSize: "cover", backgroundRepeat: "no-repeat" };
  }
  const cx = (faceBox.x + faceBox.width / 2) * 100;
  const cy = (faceBox.y + faceBox.height / 2) * 100;
  const faceArea = faceBox.width * faceBox.height;

  const targetFacePortion = avatarSize >= 240 ? 0.65 : avatarSize >= 180 ? 0.6 : 0.55;
  const rawScale = Math.min(1 / faceBox.width, 1 / faceBox.height) * targetFacePortion;

  const minScale = faceArea < 0.03 ? 2.0 : 1.0;
  const maxScale = faceArea > 0.25 ? 1.0 : 8;

  const scale = Math.max(minScale, Math.min(maxScale, rawScale));
  return {
    backgroundPosition: `${cx}% ${cy}%`,
    backgroundSize: `${scale * 100}%`,
    backgroundRepeat: "no-repeat",
  };
}

/** Parse a face_box value coming back from Supabase (object or JSON string). */
export function parseFaceBox(raw: unknown): FaceBox {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as FaceBox; } catch { return null; }
  }
  if (typeof raw === "object") return raw as FaceBox;
  return null;
}
