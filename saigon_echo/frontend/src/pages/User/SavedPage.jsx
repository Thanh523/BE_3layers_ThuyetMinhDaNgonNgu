import { useOutletContext } from 'react-router-dom';
import PlaceListPage from './PlaceListPage';

export default function SavedPage() {
  const props = useOutletContext();
  return <PlaceListPage {...props} eyebrow="ĐÃ LƯU" title="Địa điểm yêu thích" savedOnly />;
}
