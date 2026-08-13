// Client-side image compression using the Canvas API. Runs entirely in the
// browser before upload — no server cost, no extra dependency.
//
// Why: Supabase's free plan gives only 5GB of cached egress per billing
// cycle, and full-resolution photos (product shots, payment slips) are
// often several MB each straight off a phone camera, even though they're
// only ever displayed at a few hundred pixels wide. Shrinking them before
// upload cuts both storage usage and — more importantly — the bandwidth
// spent serving them to every visitor.

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function fitDimensions(width: number, height: number, maxDim: number) {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = width > height ? maxDim / width : maxDim / height;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export type CompressOptions = { maxDim?: number; quality?: number };

// Compresses a File/Blob into a JPEG. Returns the original blob unchanged
// if compression would not actually save meaningful space (tiny images,
// or if canvas/toBlob isn't available for some reason).
export async function compressImage(blob: Blob, opts: CompressOptions = {}): Promise<Blob> {
  const maxDim = opts.maxDim ?? 1200;
  const quality = opts.quality ?? 0.8;

  try {
    const img = await loadImageFromBlob(blob);
    const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, maxDim);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(img, 0, 0, width, height);

    const compressed: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );

    if (!compressed) return blob;
    // don't bother if the "compressed" version isn't actually smaller
    return compressed.size < blob.size ? compressed : blob;
  } catch {
    // if anything goes wrong (e.g. unsupported format), just upload the original
    return blob;
  }
}

// Same as compressImage, but returns a File (keeps a usable filename/type
// for code paths that expect a File rather than a bare Blob).
export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<File> {
  const blob = await compressImage(file, opts);
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
