const API = "https://clipdrop-api.co/remove-background";

function key() {
  const k = process.env.CLIPDROP_API_KEY;
  if (!k) throw new Error("Missing CLIPDROP_API_KEY");
  return k;
}

export async function removeBackground(file: File): Promise<ArrayBuffer> {

  const form = new FormData();
  form.append("image_file", file);

  const response = await fetch(API, {
    method: "POST",
    headers: {
      "x-api-key": key()
    },
    body: form
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clipdrop error: ${text}`);
  }

  return await response.arrayBuffer();
}