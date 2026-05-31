import ClientDetailView from '@/components/views/client-detail-view';

export const metadata = { title: 'Detalhes do Cliente — FaturaAO' };

export default function ClientPage({ params }: { params: { id: string } }) {
  return <ClientDetailView id={params.id} />;
}
