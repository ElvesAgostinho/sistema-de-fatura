// This route is inside AppShell — redirect permanently to the standalone /pos route.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function OldPOSPage() {
  redirect('/pos');
}
