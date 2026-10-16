import { pipValue, lotSize, positionSize, profitLoss, margin } from './xauusd-calculator.js';
const $ = (id) => document.getElementById(id);
const v = (id) => parseFloat($(id).value);
const usd = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lots = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });
function bind(form, out, fn) {
  const run = () => { try { $(out).textContent = fn(); $(out).classList.remove('err'); } catch (e) { $(out).textContent = e.message; $(out).classList.add('err'); } };
  $(form).addEventListener('input', run); $(form).addEventListener('submit', (e) => { e.preventDefault(); run(); }); run();
}
bind('f-pip', 'o-pip', () => `Pip value: ${usd(pipValue(v('pip-lots')))} per pip ($0.10 move)`);
bind('f-lot', 'o-lot', () => { const r = lotSize(v('lot-bal'), v('lot-risk'), v('lot-stop'), { lotStep: 0.01 }); return `Risk ${usd(r.riskAmount)} → ${lots(r.lots)} lots (${lots(r.ounces)} oz)`; });
bind('f-pos', 'o-pos', () => { const r = positionSize({ balance: v('pos-bal'), riskPct: v('pos-risk'), entry: v('pos-entry'), stop: v('pos-stop'), lotStep: 0.01 }); return `Stop ${lots(r.stopPips)} pips · risk ${usd(r.riskAmount)} → ${lots(r.lots)} lots · notional ${usd(r.notional)}`; });
bind('f-pl', 'o-pl', () => { const p = profitLoss(v('pl-entry'), v('pl-exit'), v('pl-lots'), $('pl-side').value); return `${p >= 0 ? 'Profit' : 'Loss'}: ${usd(Math.abs(p))}`; });
bind('f-mg', 'o-mg', () => `Required margin: ${usd(margin(v('mg-lots'), v('mg-price'), v('mg-lev')))}`);
