import type { MetadataRoute } from "next";

// share_target lets Android users "Share" a slip image from their bank app straight into เป๋าตังค์.
type ManifestWithShare = MetadataRoute.Manifest & {
  share_target?: {
    action: string;
    method: "POST";
    enctype: "multipart/form-data";
    params: { files: { name: string; accept: string[] }[] };
  };
};

export default function manifest(): ManifestWithShare {
  return {
    id: "/",
    name: "เป๋าตังค์",
    short_name: "เป๋าตังค์",
    description: "บันทึกรายรับรายจ่าย พร้อมเก็บสลิปโอนเงิน",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffeef6",
    theme_color: "#ff8fc0",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "slip", accept: ["image/*"] }] },
    },
  };
}
