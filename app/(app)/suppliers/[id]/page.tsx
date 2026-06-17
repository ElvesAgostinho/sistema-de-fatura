import SupplierDetailView from '@/components/views/supplier-detail-view';

export const metadata = {
  title: 'Detalhes do Fornecedor — FaturaAO',
};

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  return <SupplierDetailView id={params.id} />;
}
