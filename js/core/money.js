// Semua uang = integer sen (Rp x 100). Rate = basis points (1% = 100). Tanpa parseFloat.
export const roundDiv = (a, b) => Math.floor((a * 2 + b) / (b * 2));
export const ceilDiv = (a, b) => Math.floor((a + b - 1) / b);

export function parseMoney(str) {
  const [w = '0', f = ''] = String(str).replace(/[^\d.]/g, '').split('.');
  return parseInt(w || '0', 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
}
export function fmtMoney(c) {
  const neg = c < 0; c = Math.abs(c);
  const w = Math.floor(c / 100), f = c % 100;
  return (neg ? '-' : '') + 'Rp ' + w.toLocaleString('id-ID') + (f ? ',' + String(f).padStart(2, '0') : '');
}
export function fmtBp(bp) {
  const w = Math.floor(bp / 100), f = bp % 100;
  return w + (f ? ',' + String(f).padStart(2, '0') : '') + '%';
}
