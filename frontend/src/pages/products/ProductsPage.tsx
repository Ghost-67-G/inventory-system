import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { fetchProducts } from '../../api/endpoints/products';
import { DataTable } from '../../components/shared/DataTable';
import { PageHeader } from '../../components/shared/PageHeader';
import type { Product } from '../../types';

const columnHelper = createColumnHelper<Product>();

const columns: Array<ColumnDef<Product>> = [
  columnHelper.accessor('sku', { header: 'SKU', cell: (info) => info.getValue() }),
  columnHelper.accessor('name', { header: 'Name', cell: (info) => info.getValue() }),
  columnHelper.accessor('totalStock', { header: 'Stock', cell: (info) => String(info.getValue()) }),
  columnHelper.accessor('sellingPrice', { header: 'Price', cell: (info) => String(info.getValue()) })
] as Array<ColumnDef<Product>>;

export function ProductsPage() {
  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await fetchProducts();
      const payload = response.data as { success: boolean; data: Product[] };
      return payload.data;
    }
  });

  return (
    <div>
      <PageHeader title="Products" subtitle="Catalog and stock values" />
      <DataTable data={data ?? []} columns={columns} />
    </div>
  );
}
