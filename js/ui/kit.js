// Pembantu UI: semua DOM dibangun dengan createElement (tanpa innerHTML).
export const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
export const btn = (t, fn, c = '') => { const b = el('button', c, t); b.type = 'button'; b.onclick = fn; return b; };
export const kv = (l, v, h) => {
  const r = el('div', 'kv'), a = el('div'); a.append(el('span', '', l)); if (h) a.append(el('small', 'hint', h));
  r.append(a, el('b', '', v)); return r;
};

export function modal(title, nodes, buttons) { // buttons: [[teks, fn, kelas]]
  const d = el('dialog'), box = el('div'), row = el('div', 'actions');
  box.append(el('h3', '', title), ...nodes);
  for (const [t, fn, c] of buttons) row.append(btn(t, () => { d.close(); fn?.(); }, c));
  box.append(row); d.append(box); d.onclose = () => d.remove(); document.body.append(d); d.showModal();
}

export function ask({ title, intro, fields = [], ok = 'Simpan' }) { // → Promise<{nama: nilai}|null>
  return new Promise(res => {
    const d = el('dialog'), f = el('form'), inputs = {}; f.method = 'dialog';
    f.append(el('h3', '', title)); if (intro) f.append(el('p', 'hint', intro));
    for (const x of fields) {
      const l = el('label', '', x.label); let i;
      if (x.options) { i = el('select'); x.options.forEach(o => { const op = el('option', '', o); op.value = o; i.append(op); }); }
      else { i = el('input'); i.type = x.type || 'text'; if (x.min != null) i.min = x.min; if (x.type === 'number') i.step = 'any'; }
      if (x.value != null) i.value = x.value; if (x.required) i.required = true;
      inputs[x.name] = i; l.append(i); if (x.hint) l.append(el('small', 'hint', x.hint)); f.append(l);
    }
    const row = el('div', 'actions'), c = btn('Batal', () => d.close('cancel'), 'ghost'), s = el('button', '', ok);
    s.type = 'submit'; s.value = 'ok'; row.append(c, s); f.append(row); d.append(f); document.body.append(d);
    d.onclose = () => { res(d.returnValue === 'ok' ? Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value])) : null); d.remove(); };
    d.showModal();
  });
}
