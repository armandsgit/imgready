import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_API_URL is not set" },
        { status: 500 }
      );
    }

    const formData = await req.formData();

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    const backendForm = new FormData();
    backendForm.append("file", image);

    const maskCleanup = formData.get("maskCleanup");
    const model = formData.get("model");
    const quality = formData.get("quality");

    if (typeof maskCleanup === "string") backendForm.append("mask_cleanup", maskCleanup);
    if (typeof model === "string") backendForm.append("model", model);
    if (typeof quality === "string") backendForm.append("quality", quality);

    const response = await fetch(`${apiUrl}/remove-bg`, {
      method: "POST",
      body: backendForm,
    });

    if (!response.ok) {
      const text = await response.text();
      return new NextResponse(text || "Backend error", {
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("remove-bg proxy failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}