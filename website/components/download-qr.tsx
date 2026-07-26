import QRCode from "qrcode";
import { DOWNLOAD_URL } from "./site-links";

export async function DownloadQrCode() {
  const source = await QRCode.toDataURL(DOWNLOAD_URL, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 280,
    color: {
      dark: "#151124",
      light: "#ffffff",
    },
  });

  return (
    // The QR image is generated locally at render time from our fixed release URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="QR code for downloading the SafeCity Android APK"
      className="download-qr-image"
      height="280"
      src={source}
      width="280"
    />
  );
}
