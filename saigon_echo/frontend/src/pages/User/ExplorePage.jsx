import { useOutletContext } from 'react-router-dom';
import PlaceListPage from './PlaceListPage';

export default function ExplorePage() {
  const props = useOutletContext();
  return (
    <PlaceListPage
      {...props}
      eyebrow="HÀNH TRÌNH CỦA RIÊNG BẠN"
      title="Những điểm đến, những câu chuyện"
      showHero
    />
  );
}
