// Tiêu đề trang đồng nhất; nút hành động là thành phần truyền từ từng page.
export default function PageHeader({ kicker, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{kicker || 'QUẢN TRỊ NỘI DUNG'}</div><h1>{title}</h1><p>{description}</p></div>{action && <div>{action}</div>}</div>;
}
