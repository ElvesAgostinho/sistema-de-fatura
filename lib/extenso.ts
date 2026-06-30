export function numeroPorExtenso(numero: number): string {
  if (numero === 0) return 'Zero Kwanzas';

  const inteiros = Math.floor(numero);
  const centimos = Math.round((numero - inteiros) * 100);

  const extensoInteiros = inteiros > 0 ? converterGrupo(inteiros) + (inteiros === 1 ? ' Kwanza' : ' Kwanzas') : '';
  const extensoCentimos = centimos > 0 ? converterGrupo(centimos) + (centimos === 1 ? ' Cêntimo' : ' Cêntimos') : '';

  if (extensoInteiros && extensoCentimos) {
    return `${extensoInteiros} e ${extensoCentimos}`;
  }
  return extensoInteiros || extensoCentimos;
}

const unidades = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'];
const deDezAVinte = ['Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezasseis', 'Dezassete', 'Dezoito', 'Dezanove'];
const dezenas = ['', 'Dez', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa'];
const centenas = ['', 'Cem', 'Duzentos', 'Trezentos', 'Quatrocentos', 'Quinhentos', 'Seiscentos', 'Setecentos', 'Oitocentos', 'Novecentos'];

function converterGrupo(n: number): string {
  if (n === 0) return '';
  if (n < 10) return unidades[n];
  if (n >= 10 && n < 20) return deDezAVinte[n - 10];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return dezenas[d] + (u > 0 ? ' e ' + unidades[u] : '');
  }
  if (n === 100) return 'Cem';
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return (c === 1 ? 'Cento' : centenas[c]) + (resto > 0 ? ' e ' + converterGrupo(resto) : '');
  }
  if (n < 1000000) {
    const m = Math.floor(n / 1000);
    const resto = n % 1000;
    const strMil = m === 1 ? 'Mil' : converterGrupo(m) + ' Mil';
    return strMil + (resto > 0 ? (resto < 100 || resto % 100 === 0 ? ' e ' : ' ') + converterGrupo(resto) : '');
  }
  if (n < 1000000000) {
    const mi = Math.floor(n / 1000000);
    const resto = n % 1000000;
    const strMi = converterGrupo(mi) + (mi === 1 ? ' Milhão' : ' Milhões');
    return strMi + (resto > 0 ? (resto < 100000 || resto % 100000 === 0 ? ' e ' : ' ') + converterGrupo(resto) : '');
  }
  return n.toString(); // Fallback para números absurdamente grandes
}
