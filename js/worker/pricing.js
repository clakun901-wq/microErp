// Chain of Responsibility: tiap handler mengolah konteks lalu meneruskan ke berikutnya.
import { ceilDiv, roundDiv } from '../core/money.js';

export const PLATFORMS = [ // contoh tarif; sesuaikan. feeBp/payBp dalam bp, fixed dalam sen
  { name: 'Shopee',    feeBp: 800, payBp: 200, fixed: 100000 },
  { name: 'Tokopedia', feeBp: 600, payBp: 180, fixed: 100000 },
  { name: 'TikTok',    feeBp: 500, payBp: 220, fixed: 0 },
];
const PPN_BP = 1100; // PPN 11% atas biaya layanan

class Handler {
  setNext(h) { this.next = h; return h; }
  handle(c) { return this.next ? this.next.handle(c) : c; }
}
class BaseCost extends Handler {
  handle(c) { c.base = c.cost + c.fixed; return super.handle(c); }
}
class EffectiveRate extends Handler {
  handle(c) {
    c.effBp = roundDiv((c.feeBp + c.payBp) * (10000 + PPN_BP), 10000);
    const d = 10000 - c.effBp - c.marginBp;
    if (d <= 0) throw new Error('Margin + biaya >= 100%');
    c.denom = d; return super.handle(c);
  }
}
class GrossUp extends Handler {
  handle(c) { c.price = ceilDiv(c.base * 10000, c.denom); return super.handle(c); }
}
class RoundUp extends Handler { // bulatkan ke atas ke Rp100
  handle(c) { c.price = ceilDiv(c.price, 10000) * 10000; return super.handle(c); }
}
class Fees extends Handler {
  handle(c) {
    c.fee = roundDiv(c.price * c.feeBp, 10000) + roundDiv(c.price * c.payBp, 10000);
    c.tax = roundDiv(c.fee * PPN_BP, 10000);
    return super.handle(c);
  }
}
class Profit extends Handler {
  handle(c) { c.profit = c.price - c.cost - c.fixed - c.fee - c.tax; return super.handle(c); }
}

export function buildPipeline() {
  const head = new BaseCost();
  head.setNext(new EffectiveRate()).setNext(new GrossUp()).setNext(new RoundUp())
      .setNext(new Fees()).setNext(new Profit());
  return head;
}

export const CHANNELS = {
  'Shopee': PLATFORMS[0], 'Tokopedia': PLATFORMS[1], 'TikTok Shop': PLATFORMS[2],
  'Manual': { name: 'Manual', feeBp: 0, payBp: 0, fixed: 0 },
};
