const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm"
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function safeMediaExtension(contentType: string) {
  return EXTENSION_BY_TYPE[contentType] ?? null;
}

export async function hasValidMediaSignature(file: File) {
  const bytes = new Uint8Array(
    await file.slice(0, 32).arrayBuffer()
  );

  if (file.type === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (file.type === "image/png") {
    const signature = [
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a
    ];

    return (
      bytes.length >= signature.length &&
      signature.every((value, index) => bytes[index] === value)
    );
  }

  if (file.type === "image/webp") {
    return (
      bytes.length >= 12 &&
      ascii(bytes, 0, 4) === "RIFF" &&
      ascii(bytes, 8, 4) === "WEBP"
    );
  }

  if (file.type === "image/avif") {
    if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") {
      return false;
    }

    const brand = ascii(bytes, 8, 4);
    return brand === "avif" || brand === "avis";
  }

  if (file.type === "video/mp4") {
    return bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp";
  }

  if (file.type === "video/webm") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }

  return false;
}
