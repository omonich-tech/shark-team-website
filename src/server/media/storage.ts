import { del, put } from "@vercel/blob";

export async function storeMediaFile(file: File, pathname: string) {
  if (process.env.MEDIA_DRY_RUN === "true") {
    return {
      url: `https://media.invalid/${encodeURIComponent(pathname)}`,
      pathname
    };
  }

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true
  });

  return {
    url: blob.url,
    pathname: blob.pathname
  };
}

export async function deleteMediaFile(url: string) {
  if (process.env.MEDIA_DRY_RUN === "true") {
    return;
  }

  await del(url);
}
