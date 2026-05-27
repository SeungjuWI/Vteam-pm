import heic2any from "heic2any";

/**
 * HEIC/HEIF 파일을 JPEG Blob으로 변환
 */
async function convertHeic(file: File): Promise<Blob> {
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(result) ? result[0] : result;
}

/**
 * 이미지를 리사이즈+압축하여 Blob으로 반환
 * - HEIC/HEIF 자동 변환
 * - 최대 크기: maxSize x maxSize (기본 256px)
 * - 포맷: WebP (미지원 시 JPEG)
 * - 품질: 0.8
 */
export async function compressImage(
  file: File,
  maxSize = 256
): Promise<{ blob: Blob; dataUrl: string }> {
  // HEIC/HEIF 변환
  let source: Blob = file;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "heic" || ext === "heif" || file.type === "image/heic" || file.type === "image/heif") {
    source = await convertHeic(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");

      let w = img.width;
      let h = img.height;

      if (w > h) {
        if (w > maxSize) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        }
      } else {
        if (h > maxSize) {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.drawImage(img, 0, 0, w, h);

      const type = canvas.toDataURL("image/webp").startsWith("data:image/webp")
        ? "image/webp"
        : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const dataUrl = canvas.toDataURL(type, 0.8);
          resolve({ blob, dataUrl });
        },
        type,
        0.8
      );
    };
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = URL.createObjectURL(source);
  });
}
