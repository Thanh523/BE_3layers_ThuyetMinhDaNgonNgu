// Chọn giữa ảnh người dùng tải lên và ảnh SVG minh họa khi chưa có ảnh thật.
import { useDemoData } from '../../contexts/DemoDataContext';
import useFileUrl from '../../hooks/useFileUrl';
import PlaceArtwork from './PlaceArtwork';
export default function MediaImage({ image, place, alt = '', className = '' }) {
  const { data } = useDemoData();
  const cover = image || (place?.imageUrl === undefined
    ? data.images.find(item => item.locationId === place?.id && item.isCover)
    : null);
  const url = useFileUrl(cover?.fileId);
  const remoteUrl = cover?.fileUrl || cover?.url || place?.imageUrl;
  const source = remoteUrl || url;
  return source
    ? <img className={`media-image ${className}`} src={source} alt={alt || cover?.caption || place?.name || 'Hình ảnh'} />
    : <PlaceArtwork place={place} className={className}/>;
}
