import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
    </div>
  );
}
