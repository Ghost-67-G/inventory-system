import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';

export function ProductDetailPage() {
  const { id } = useParams();

  return (
    <div>
      <PageHeader title="Product Detail" subtitle={`Product ID: ${id ?? ''}`} />
      <div className="rounded border bg-white p-4">Detailed product view scaffold.</div>
    </div>
  );
}
