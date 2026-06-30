import { getPhotoBlob } from "./photos";

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Draw an image to cover a rect (object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Build a branded share collage from completion photos. Layout adapts to
 * photo count (1 / 2 / 3 / 4+), with a Horizon frame and watermark.
 */
export async function generateCollage(
  photoIds: string[],
  title: string
): Promise<Blob | null> {
  const blobs = (
    await Promise.all(photoIds.map((id) => getPhotoBlob(id)))
  ).filter((b): b is Blob => !!b);
  if (blobs.length === 0) return null;

  const imgs = await Promise.all(blobs.map(loadImage));

  const W = 1080;
  const H = 1350;
  const pad = 48;
  const gap = 16;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Frame background (warm gradient).
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1C1B1B");
  grad.addColorStop(1, "#2A1E18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const areaX = pad;
  const areaY = pad;
  const areaW = W - pad * 2;
  const areaH = H - pad * 2 - 110; // leave room for footer

  const n = Math.min(imgs.length, 4);
  if (n === 1) {
    drawCover(ctx, imgs[0], areaX, areaY, areaW, areaH);
  } else if (n === 2) {
    const hh = (areaH - gap) / 2;
    drawCover(ctx, imgs[0], areaX, areaY, areaW, hh);
    drawCover(ctx, imgs[1], areaX, areaY + hh + gap, areaW, hh);
  } else if (n === 3) {
    const topH = areaH * 0.62;
    const botH = areaH - topH - gap;
    const halfW = (areaW - gap) / 2;
    drawCover(ctx, imgs[0], areaX, areaY, areaW, topH);
    drawCover(ctx, imgs[1], areaX, areaY + topH + gap, halfW, botH);
    drawCover(ctx, imgs[2], areaX + halfW + gap, areaY + topH + gap, halfW, botH);
  } else {
    const halfW = (areaW - gap) / 2;
    const halfH = (areaH - gap) / 2;
    drawCover(ctx, imgs[0], areaX, areaY, halfW, halfH);
    drawCover(ctx, imgs[1], areaX + halfW + gap, areaY, halfW, halfH);
    drawCover(ctx, imgs[2], areaX, areaY + halfH + gap, halfW, halfH);
    drawCover(ctx, imgs[3], areaX + halfW + gap, areaY + halfH + gap, halfW, halfH);
  }

  // Footer: dot + title + watermark.
  const footY = H - pad - 40;
  ctx.fillStyle = "#FFB693";
  ctx.beginPath();
  ctx.arc(areaX + 14, footY, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#F0F0F5";
  ctx.font = "600 38px -apple-system, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const maxTitleW = areaW - 220;
  let t = title;
  while (ctx.measureText(t).width > maxTitleW && t.length > 4) {
    t = t.slice(0, -2);
  }
  if (t !== title) t = t.trimEnd() + "…";
  ctx.fillText(t, areaX + 40, footY);

  ctx.fillStyle = "rgba(240,240,245,0.65)";
  ctx.font = "700 30px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("HORIZON", W - pad, footY);
  ctx.textAlign = "left";

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
  );
}

/** Share the collage via the Web Share API, falling back to a download. */
export async function shareCollage(blob: Blob, title: string) {
  const file = new File([blob], "horizon-quest.jpg", { type: "image/jpeg" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: "My Horizon sidequest",
        text: `I completed "${title}" on Horizon ✨`,
      });
      return;
    } catch {
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "horizon-quest.jpg";
  a.click();
  URL.revokeObjectURL(url);
}
