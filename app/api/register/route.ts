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

    const response = await fetch(`${apiUrl}/remove-bg`, {
      method: "POST",
      body: formData,
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
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}