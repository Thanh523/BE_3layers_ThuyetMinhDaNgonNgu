// Select địa điểm dùng chung cho hình ảnh, âm thanh, thuyết minh và QR.
import { useDemoData } from '../../contexts/DemoDataContext';
export default function PlacePicker({
  value,
  onChange,
  all = false,
  required = false,
  label = 'Địa điểm',
  places: suppliedPlaces,
  disabled = false,
}) {
  const { data } = useDemoData();
  const places = suppliedPlaces || data.locations;
  return <label className="field"><span>{label}</span><select disabled={disabled} required={required} value={value} onChange={event => onChange(event.target.value)}>
    <option value="">{all ? 'Tất cả địa điểm' : '-- Chọn địa điểm --'}</option>
    {places.map(place => <option value={place.id} key={place.id}>{place.name}</option>)}
  </select></label>;
}
