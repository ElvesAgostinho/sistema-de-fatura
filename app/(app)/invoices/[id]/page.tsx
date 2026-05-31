import InvoiceDetailView from '@/components/views/invoice-detail-view';

export const metadata = { title: 'Fatura · FaturaAO' };
export default function Page({ params }: { params: { id: string } }) {
  return <InvoiceDetailView id={params.id} />;
}
