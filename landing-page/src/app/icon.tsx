import { ImageResponse } from "next/og";
import { BRAND_BACKGROUND, BRAND_INK, MONOGRAM_PATH } from "@/lib/brand";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        <svg width="320" height="320" viewBox="0 0 33 33" fill="none">
          <path d={MONOGRAM_PATH} fill={BRAND_BACKGROUND} />
        </svg>
      </div>
    ),
    size
  );
}
