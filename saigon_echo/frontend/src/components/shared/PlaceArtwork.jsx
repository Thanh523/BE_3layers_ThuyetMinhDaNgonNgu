// Đồ họa minh họa tự vẽ bằng SVG, dựa trên cảm hứng kiến trúc trong HTML tham chiếu.
// Không cần mạng hoặc tải ảnh ngoài: người xem demo vẫn có ảnh khi chạy offline.
export default function PlaceArtwork({ place, className = '' }) {
  const art = place?.artwork || 'palace';
  return <svg className={`artwork ${className}`} viewBox="0 0 640 360" role="img" aria-label={`Minh họa ${place?.name || 'địa điểm'}`} preserveAspectRatio="xMidYMid slice">
    <rect width="640" height="360" fill={place?.color || '#d5ded0'} />
    <circle cx="515" cy="75" r="42" fill="#fff3cf" opacity=".85" />
    <path d="M0 258 Q160 232 320 258 T640 255 V360 H0Z" fill="#b5cfc0" opacity=".8" />
    {art === 'palace' && <g><rect x="85" y="150" width="470" height="156" fill="#eee4cc"/><rect x="108" y="130" width="426" height="18" fill="#d3c49e"/><rect x="130" y="108" width="385" height="20" fill="#f2ead8"/>{Array.from({length: 10}, (_, i) => <rect key={i} x={105+i*45} y="171" width="24" height="94" fill="#526d5e" />)}<rect x="272" y="237" width="92" height="69" fill="#254a3e"/><path d="M315 102 V70 L347 82 L315 94" fill="#c9684e" /></g>}
    {art === 'post' && <g><rect x="75" y="159" width="490" height="149" fill="#e0b967"/><path d="M210 159 V125 Q320 15 430 125 V159" fill="#f5d991"/><circle cx="320" cy="120" r="29" fill="#fff4d0" stroke="#916a4b" strokeWidth="7"/>{Array.from({length: 9}, (_, i) => <path key={i} d={`M${95+i*54} 304v-77q25-45 44 0v77`} fill="#456252" />)}</g>}
    {art === 'market' && <g><rect x="95" y="176" width="450" height="130" fill="#e6bd91"/><path d="M75 176 L320 100 L565 176Z" fill="#bb765c"/><rect x="278" y="82" width="84" height="94" fill="#e7c89b"/><path d="M270 82 L320 44 L370 82Z" fill="#a7513d"/><circle cx="320" cy="117" r="21" fill="#fff3d7" stroke="#825f4d" strokeWidth="4"/>{Array.from({length: 8}, (_, i) => <rect key={i} x={113+i*54} y="201" width="28" height="70" fill="#547566" />)}</g>}
    {art === 'opera' && <g><rect x="92" y="164" width="452" height="142" fill="#faf1df"/><path d="M80 164 L320 87 L555 164" fill="#d7bb94"/><path d="M210 136 Q320 30 430 136" fill="none" stroke="#faf1df" strokeWidth="25"/>{Array.from({length: 6}, (_, i) => <rect key={i} x={130+i*73} y="175" width="35" height="130" fill="#c6ad8c" />)}<path d="M210 306 V225 Q320 135 430 225 V306" fill="#4b665b" /></g>}
    {art === 'street' && <g><path d="M255 360 L315 175 L390 175 L458 360" fill="#e8d9c1"/><rect x="65" y="92" width="130" height="185" fill="#a2b4a6"/><rect x="480" y="110" width="95" height="167" fill="#a2b4a6"/>{Array.from({length: 6}, (_, i) => <rect key={i} x={82+(i%3)*34} y={112+Math.floor(i/3)*50} width="19" height="32" fill="#d8e8dc" />)}<path d="M327 175v-62" stroke="#718d7e" strokeWidth="8" /></g>}
    {art === 'river' && <g><path d="M0 238 Q150 210 310 248 Q445 280 640 228 V360 H0Z" fill="#8fb9c0"/><path d="M0 289 Q120 264 240 291 T495 296 T640 287" fill="none" stroke="#daeef0" strokeWidth="10"/><rect x="100" y="122" width="85" height="115" fill="#8aa5a5"/><rect x="215" y="156" width="68" height="86" fill="#a8bdbb"/><path d="M376 233 L514 233 L487 267 L405 267Z" fill="#3f645c"/><path d="M438 233 V176 L490 226" fill="#f5e3c2" /></g>}
    <rect x="0" y="306" width="640" height="54" fill="#173e35" opacity=".08" />
  </svg>;
}
