import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { makePortrait, PORTRAIT_EDGE, PORTRAIT_MAX_BYTES, sniffPortraitType } from "@/lib/portraits";

const image = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#7a9a3a" } });

describe("character pictures", () => {
  it("knows PNG, JPEG, WebP and GIF by their first bytes, not SVG or PDF", async () => {
    expect(sniffPortraitType(await image(4, 4).png().toBuffer())).toBe("image/png");
    expect(sniffPortraitType(await image(4, 4).jpeg().toBuffer())).toBe("image/jpeg");
    expect(sniffPortraitType(await image(4, 4).webp().toBuffer())).toBe("image/webp");
    expect(sniffPortraitType(await image(4, 4).gif().toBuffer())).toBe("image/gif");
    expect(sniffPortraitType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffPortraitType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("re-encodes to a WebP that fits the size limit and keeps the shape", async () => {
    const p = await makePortrait(await image(2000, 1000).jpeg().toBuffer());
    expect(p.contentType).toBe("image/webp");
    expect(sniffPortraitType(p.data)).toBe("image/webp");
    expect([p.width, p.height]).toEqual([PORTRAIT_EDGE, PORTRAIT_EDGE / 2]);
  });

  it("does not enlarge a small picture", async () => {
    const p = await makePortrait(await image(120, 150).png().toBuffer());
    expect([p.width, p.height]).toEqual([120, 150]);
  });

  it("drops photo metadata such as EXIF", async () => {
    const withExif = await image(64, 64).jpeg().withExif({ IFD0: { Make: "Phone", Copyright: "secret place" } }).toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const p = await makePortrait(withExif);
    expect((await sharp(p.data).metadata()).exif).toBeUndefined();
  });

  it("refuses empty, oversized, unknown and broken files", async () => {
    await expect(makePortrait(new Uint8Array())).rejects.toThrow("Choose a picture");
    await expect(makePortrait(new Uint8Array(PORTRAIT_MAX_BYTES + 1))).rejects.toThrow("over 8 MB");
    await expect(makePortrait(new TextEncoder().encode("<svg/>"))).rejects.toThrow("PNG, JPEG, WebP or GIF");
    await expect(makePortrait(new Uint8Array([0xff, 0xd8, 0xff, 0, 1, 2, 3]))).rejects.toThrow("couldn't be read");
  });
});
