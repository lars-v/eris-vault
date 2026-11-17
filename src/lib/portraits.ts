import sharp from "sharp";

/**
 * Character pictures. These are not game rules. Every upload is decoded and
 * re-encoded here, so what the app stores and serves is always a plain WebP
 * the server made: no camera location or other metadata, nothing the player's
 * file could smuggle in, and a small size for phones.
 */

/** The largest file a player may send (the Server Action body limit is 9 MB). */
export const PORTRAIT_MAX_BYTES = 8 * 1024 * 1024;
/** The stored picture fits inside this square, in pixels. */
export const PORTRAIT_EDGE = 800;
/** Refuse decompression bombs: about a 50 megapixel photo. */
const MAX_INPUT_PIXELS = 50_000_000;

export type PortraitInputType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export const PORTRAIT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** By the file's first bytes, not its name or the browser's claim. */
export function sniffPortraitType(bytes: Uint8Array): PortraitInputType | null {
  const at = (offset: number, ...sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp"; // RIFF....WEBP
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif"; // GIF8
  return null;
}

export type Portrait = { data: Buffer; contentType: "image/webp"; width: number; height: number };

/** Turns an uploaded file into the stored picture, or throws a message for the player. */
export async function makePortrait(bytes: Uint8Array): Promise<Portrait> {
  if (bytes.length === 0) throw new Error("Choose a picture first.");
  if (bytes.length > PORTRAIT_MAX_BYTES) throw new Error("That picture is over 8 MB. Try a smaller one.");
  if (!sniffPortraitType(bytes)) throw new Error("Use a PNG, JPEG, WebP or GIF picture.");
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate() // Phone photos stand the right way up, then the orientation tag is dropped.
      .resize(PORTRAIT_EDGE, PORTRAIT_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, contentType: "image/webp", width: info.width, height: info.height };
  } catch {
    throw new Error("That picture couldn't be read. Try another file.");
  }
}
