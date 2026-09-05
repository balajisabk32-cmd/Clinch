import { useNavigate } from 'react-router-dom';

export default function EmptyState({
  icon = '📦',
  title = 'Nothing here yet',
  description = 'Explore our catalog and find products for your business.',
  actionText = 'Browse Products',
  actionPath = '/shop',
  onAction,
}) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionPath) {
      navigate(actionPath);
    }
  };

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionText && (
        <button className="btn btn-primary" onClick={handleAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}
