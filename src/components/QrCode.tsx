import { useEffect, useState } from "react";

export function QrCode({ value, size = 128, className }: { value: string; size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    // Dynamic import: the "qrcode" package pulls in pngjs, which uses
    // util.inherits and crashes the serverless SSR bundle at import time.
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(value, {
          width: size * 2,
          margin: 1,
          color: { dark: "#0b1220", light: "#ffffff" },
          errorCorrectionLevel: "H",
        }),
      )
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [value, size]);
  if (!dataUrl) return <div style={{ width: size, height: size }} className={`bg-white/20 rounded ${className ?? ""}`} />;
  return <img src={dataUrl} width={size} height={size} className={`rounded-md ${className ?? ""}`} alt="QR" />;
}
