// Chọn giữa ảnh người dùng tải lên và ảnh SVG minh họa khi chưa có ảnh thật.
import { useDemoData } from '../../contexts/DemoDataContext';
import useFileUrl from '../../hooks/useFileUrl';
import PlaceArtwork from './PlaceArtwork';
export default function MediaImage({ image, place, alt = '', className = '' }) {
  const { data } = useDemoData();
  const cover = image || data.images.find(item => item.locationId === place?.id && item.isCover);
  const url = useFileUrl(cover?.fileId);
  return url ? <img className={`media-image ${className}`} src={url} alt={alt || cover?.caption || place?.name || 'Hình ảnh'} /> : <PlaceArtwork place={place} className={className}/>;
}
