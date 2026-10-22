// Chuyển Blob đã lưu trong IndexedDB thành URL có thể hiển thị trên img/audio.
// Thu hồi URL khi chuyển trang hoặc đổi tệp nhằm tránh rò rỉ bộ nhớ.
import { useEffect, useState } from 'react';
import { getFile } from '../services/fileStore';

export default function useFileUrl(fileId) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let localUrl = '';
    setUrl('');
    if (!fileId) return () => {};
    getFile(fileId).then(blob => {
      if (blob && active) { localUrl = URL.createObjectURL(blob); setUrl(localUrl); }
    }).catch(() => {});
    return () => { active = false; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [fileId]);
  return url;
}
