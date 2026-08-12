import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Defensive: reject any path traversal attempt in the filename.
  if (params.filename.includes("..") || params.filename.includes("/")) {
    return NextResponse.json({ error: "اسم ملف غير صالح" }, { status: 400 });
  }

  const absolutePath = path.join(process.cwd(), "uploads", "avatars", params.filename);
  try {
    const buffer = await readFile(absolutePath);
    const ext = path.extname(params.filename).toLowerCase();
    const contentType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
  } catch {
    return NextResponse.json({ error: "الصورة غير موجودة" }, { status: 404 });
  }
}
