import { ImageResponse } from "next/og";
import { BRAND_BACKGROUND, BRAND_INK, MONOGRAM_PATH } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BRAND_INK,
        }}
      >
        <svg width="112" height="112" viewBox="0 0 33 33" fill="none">
          <path d={MONOGRAM_PATH} fill={BRAND_BACKGROUND} />
        </svg>
      </div>
    ),
    size
  );
}
