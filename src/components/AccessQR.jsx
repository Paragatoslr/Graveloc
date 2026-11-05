import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function AccessQR({ value, label }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    setFailed(false);
    QRCode.toDataURL(value, {
      margin: 1,
      width: 320,
      color: { dark: "#245B48", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancel) setSrc(url);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [value]);

  if (failed) return <p>The QR code could not be drawn. The access code is still shown below.</p>;
  if (!src) return <p>Preparing QR code…</p>;
  return <img className="qr-img" src={src} alt={label} width="220" height="220" />;
}
