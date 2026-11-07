/* Shared calculator engine for the standalone calculator pages (copied from the homepage logic, unchanged). */

const exprs = { simple: '', sci: '' };

const historyData = { simple: [], sci: [] };

let justCalculated = { simple: false, sci: false };

function getNumber(id, label, min = -Infinity, max = Infinity) {
  const raw = document.getElementById(id).value.trim();
  if (raw === '') throw new Error('Please enter ' + label + '.');
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Enter a valid ' + label + (Number.isFinite(min) ? ` (minimum ${min})` : '') + (Number.isFinite(max) ? ` (maximum ${max})` : '') + '.');
  return n;
}

function runCalc(resultId, fn) {
  try { fn(); } catch (e) { showError(resultId, e); }
}

function showError(id, error) {
  const el = document.getElementById(id);
  el.textContent = error.message || 'Please check your input and try again.';
  el.style.display = 'block';
}

function showResult(id, html) {
  /* Safe rendering: the only markup allowed is <br>; everything else is plain text (no innerHTML). */
  const el = document.getElementById(id);
  const lines = String(html).split('<br>');
  el.replaceChildren();
  lines.forEach((line, i) => {
    if (i) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });
  el.style.display = 'block';
  addResultActions(el, lines.join('\n'));
}

function addResultActions(el, text) {
  const bar = document.createElement('div'); bar.className = 'r-actions';
  const status = document.createElement('span'); status.className = 'r-status'; status.setAttribute('role', 'status');
  const say = msg => { status.textContent = msg; setTimeout(() => { status.textContent = ''; }, 2200); };
  const mk = (label, aria, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'r-act'; b.textContent = label; b.setAttribute('aria-label', aria); b.addEventListener('click', fn); return b; };
  bar.appendChild(mk('Copy', 'Copy result', async () => {
    try { await navigator.clipboard.writeText(text); say('Copied ✓'); }
    catch (e) {
      try { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); say(ok ? 'Copied ✓' : 'Copy not available'); }
      catch (e2) { say('Copy not available'); }
    }
  }));
  if (navigator.share) bar.appendChild(mk('Share', 'Share result', async () => {
    try { await navigator.share({ title: 'Calculator10', text: text + '\n' + location.origin + '/' }); } catch (e) { /* user cancelled */ }
  }));
  bar.appendChild(status); el.appendChild(bar);
}

function addHistory(type, item) {
  historyData[type].unshift(item);
  if (historyData[type].length > 8) historyData[type].pop();
  const list = document.getElementById(type + '-history-list');
  list.replaceChildren();
  historyData[type].forEach(entry => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.textContent = entry;
    list.appendChild(div);
  });
  document.getElementById(type + '-history').style.display = 'block';
}

function updatePreview(type) {
  const el = document.getElementById(type + '-preview'); if (!el) return;
  el.textContent = '';
  if (type !== 'simple' || justCalculated.simple) return;
  const e = exprs.simple;
  if (!e || /[+\-*/%(.]$/.test(e) || !/[+\-*/%]/.test(e.replace(/^-/, ''))) return;
  try { el.textContent = '= ' + formatNumber(safeCalculate(e)); } catch (err) { /* incomplete or invalid: show nothing */ }
}

function updateDisplay(type, value) {
  document.getElementById(type + '-display').value = value || '0';
}

function pressKey(type, key) {
  let current = exprs[type];
  if (justCalculated[type] && /[0-9.(]/.test(key)) current = '';
  justCalculated[type] = false;
  if (key === '.') {
    const lastNumber = current.split(/[+\-*/()%]/).pop();
    if (lastNumber.includes('.')) return;
  }
  if (['+', '-', '*', '/', '**', '%'].includes(key)) {
    if (!current && key !== '-') return;
    if (/[+\-*/%]$/.test(current) && key !== '-') current = current.replace(/[+\-*/%]+$/, '');
  }
  exprs[type] = current + key;
  updateDisplay(type, exprs[type]);
  updatePreview(type);
}

function backspace(type) { exprs[type] = exprs[type].slice(0,-1); justCalculated[type] = false; updateDisplay(type, exprs[type]); updatePreview(type); }

function clearDisp(type) { exprs[type] = ''; justCalculated[type] = false; updateDisplay(type, '0'); updatePreview(type); }

function calcResult(type) {
  try {
    const currentExpr = exprs[type];
    if (type === 'simple' && window.__magic) window.__magic(currentExpr);
    const result = safeCalculate(currentExpr);
    const shown = formatNumber(result);
    updateDisplay(type, shown);
    const pv = document.getElementById(type + '-preview'); if (pv) pv.textContent = '';
    exprs[type] = plain(result);
    justCalculated[type] = true;
    addHistory(type, currentExpr + ' = ' + shown);
  } catch (err) {
    updateDisplay(type, 'Error: ' + err.message);
    showTip(type);
    exprs[type] = '';
    justCalculated[type] = false;
  }
}

function safeCalculate(expression) {
  const expr = String(expression).replace(/\s+/g,'');
  if (!expr || expr.length > 120) throw new Error('Enter a valid calculation.');
  if (!/^[0-9+\-*/%.()]+$/.test(expr)) throw new Error('Invalid characters in calculation.');
  if (/\/\s*0(?:\.0*)?(?![0-9.])/.test(expr)) throw new Error('Cannot divide by zero.');
  // Parse arithmetic without eval: recursive descent parser.
  let i = 0;
  function number() {
    let start = i;
    if (expr[i] === '+' || expr[i] === '-') i++;
    let digits = false;
    while (i < expr.length && /[0-9.]/.test(expr[i])) { if (expr[i] >= '0' && expr[i] <= '9') digits = true; i++; }
    if (!digits || (expr.slice(start,i).match(/\./g)||[]).length > 1) throw new Error('Invalid number.');
    let n = Number(expr.slice(start,i));
    if (!Number.isFinite(n)) throw new Error('Invalid number.');
    return n;
  }
  function factor() {
    let base;
    if (expr[i] === '(') {
      i++; base = sum();
      if (expr[i] !== ')') throw new Error('Missing closing parenthesis.');
      i++;
    } else {
      base = number();
    }
    if (expr.slice(i, i + 2) === '**') {
      i += 2;
      const exponent = factor();
      base = Math.pow(base, exponent);
      if (!Number.isFinite(base)) throw new Error('Result is outside the supported range.');
    }
    return base;
  }
  function term() {
    let v = factor();
    while (i < expr.length && (expr[i] === '*' || expr[i] === '/' || expr[i] === '%')) {
      let op = expr[i++], rhs = factor();
      if ((op === '/' || op === '%') && rhs === 0) throw new Error('Cannot divide by zero.');
      v = op === '*' ? v*rhs : op === '/' ? v/rhs : v%rhs;
    }
    return v;
  }
  function sum() {
    let v = term();
    while (i < expr.length && (expr[i] === '+' || expr[i] === '-')) {
      let op = expr[i++], rhs = term();
      v = op === '+' ? v+rhs : v-rhs;
    }
    return v;
  }
  const result = sum();
  if (i !== expr.length || !Number.isFinite(result)) throw new Error('Invalid calculation.');
  return result;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) throw new Error('Result is outside the supported range.');
  return Number(n.toPrecision(10)).toLocaleString('en-US', {maximumFractionDigits:8});
}

function plain(n) { return Number(n.toPrecision(12)).toLocaleString('en-US', {useGrouping:false, maximumFractionDigits:20}); }

function sciFunc(func) {
  try {
    const val = exprs.sci ? safeCalculate(exprs.sci) : 0;
    let result, label;
    if (func === 'sin') { result = Math.sin(val*Math.PI/180); label = `sin(${val}°)`; }
    else if (func === 'cos') { result = Math.cos(val*Math.PI/180); label = `cos(${val}°)`; }
    else if (func === 'tan') {
      if (Math.abs(Math.cos(val*Math.PI/180)) < 1e-10) throw new Error('Tangent is undefined at this angle.');
      result = Math.tan(val*Math.PI/180); label = `tan(${val}°)`;
    }
    else if (func === 'sqrt') { if (val < 0) throw new Error('Square root of a negative number is not real.'); result = Math.sqrt(val); label = `√(${val})`; }
    else if (func === 'sq') { result = val*val; label = `(${val})²`; }
    else if (func === 'log') { if (val <= 0) throw new Error('Log requires a number greater than zero.'); result = Math.log10(val); label = `log(${val})`; }
    const shown = formatNumber(result);
    exprs.sci = plain(result); updateDisplay('sci', shown); justCalculated.sci = true;
    addHistory('sci', label + ' = ' + shown);
  } catch (err) { updateDisplay('sci', 'Error: ' + err.message); exprs.sci = ''; justCalculated.sci = false; }
}

function calcPct() {
  runCalc('pct-result', () => {
    const pct = getNumber('pct-val','percentage',-1e9,1e9), total = getNumber('pct-total','total amount',-1e15,1e15);
    showResult('pct-result', `${formatNumber(pct)}% of ${formatNumber(total)} = ${formatNumber(pct/100*total)}`);
  });
}

/* Encouraging line shown under the display after an error. Shown only; not saved anywhere. */
const TIPS = [
  "No worries. Every mistake is a step to a better answer.",
  "Almost there! Check the numbers and try once more.",
  "Small slip, big progress. Give it another go.",
  "Good effort! Re-check the operator and try again.",
  "Mistakes are part of learning. You've got this.",
  "Take a breath, check the numbers, and try again."
];
let lastTip = -1;
function showTip(type) {
  const el = document.getElementById(type + '-preview'); if (!el) return;
  let i; do { i = Math.floor(Math.random() * TIPS.length); } while (TIPS.length > 1 && i === lastTip);
  lastTip = i; el.textContent = TIPS[i];
}
