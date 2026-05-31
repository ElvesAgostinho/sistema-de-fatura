'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white hover:bg-white/30 rounded-md font-medium text-sm transition-colors print:hidden"
    >
      <Printer className="w-4 h-4" />
      Imprimir Documento
    </button>
  );
}
