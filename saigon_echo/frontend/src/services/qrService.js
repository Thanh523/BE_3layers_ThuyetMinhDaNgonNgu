// Sinh mã QR thật từ URL trang tham quan công khai, không cần gọi API.
import QRCode from 'qrcode';
export function getPublicUrl(slug) {
  return `${window.location.origin}/tham-quan/${encodeURIComponent(slug)}`;
}
export function createQRImage(url) {
  return QRCode.toDataURL(url, { width: 440, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#173e35', light: '#ffffff' } });
}
export function downloadDataURL(dataURL, filename) {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
