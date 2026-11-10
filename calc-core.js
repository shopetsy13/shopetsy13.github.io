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


function calcDiscount() {
  runCalc('discount-result', () => {
    const price = getNumber('disc-price','original price',0,1e15), pct = getNumber('disc-off','discount percentage',0,100);
    const discount = price*pct/100;
    showResult('discount-result', `Discount amount: ${formatNumber(discount)}<br>Final price: ${formatNumber(price-discount)}`);
  });
}

function calcGold() {
  runCalc('gold-result', () => {
    const w = getNumber('gold-weight','weight',0,1e9), price = getNumber('gold-price','price per tola',0,1e15);
    const unit = document.getElementById('gold-unit').value, karat = Number(document.getElementById('gold-karat').value);
    const TOLA_G = 11.6638;
    const tola = unit === 'tola' ? w : unit === 'gram' ? w / TOLA_G : unit === 'masha' ? w / 12 : w / 96;
    const value = tola * price * karat / 24;
    showResult('gold-result', `Weight: ${formatNumber(tola)} tola (${formatNumber(tola * TOLA_G)} g)<br>Purity: ${karat}K<br>Estimated value: ${formatNumber(value)}`);
  });
}

function calcCalories() {
  runCalc('calorie-result', () => {
    const w = getNumber('cal-weight','weight',20,500), h = getNumber('cal-height','height',100,250), age = getNumber('cal-age','age',18,120);
    const sex = document.getElementById('cal-sex').value;
    const activity = Number(document.getElementById('cal-activity').value);
    const bmr = 10*w + 6.25*h - 5*age + (sex === 'male' ? 5 : -161);
    const calories = bmr*activity;
    showResult('calorie-result', `Estimated BMR: ${formatNumber(bmr)} kcal/day<br>Estimated maintenance calories: ${formatNumber(calories)} kcal/day`);
  });
}

function calcWater() {
  runCalc('water-result', () => {
    const w = getNumber('water-weight','weight',1,500);
    const liters = w*0.035;
    showResult('water-result', `Rough estimate: ${formatNumber(liters)} liters/day<br>Equivalent to about ${formatNumber(liters*1000)} mL/day`);
  });
}

const UNIT_DATA = {
  length: { mm:['Millimeter',0.001], cm:['Centimeter',0.01], m:['Meter',1], km:['Kilometer',1000], in:['Inch',0.0254], ft:['Foot',0.3048], yd:['Yard',0.9144], mi:['Mile',1609.344] },
  weight: { g:['Gram',0.001], kg:['Kilogram',1], tola:['Tola',0.0116638], seer:['Seer',0.933105], maund:['Maund',37.3242], lb:['Pound',0.45359237], oz:['Ounce',0.028349523] },
  temp: { c:['Celsius',0], f:['Fahrenheit',0], k:['Kelvin',0] },
  speed: { kmh:['Kilometer/hour',1/3.6], ms:['Meter/second',1], mph:['Mile/hour',0.44704], kn:['Knot',1852/3600], fts:['Foot/second',0.3048] },
  volume: { l:['Liter',1], ml:['Milliliter',0.001], m3:['Cubic meter',1000], gal:['US gallon',3.785411784], qt:['US quart',0.946352946], cup:['US cup',0.2365882365], floz:['US fluid ounce',0.0295735295625], tbsp:['US tablespoon',0.01478676478125], tsp:['US teaspoon',0.00492892159375] },
  time: { s:['Second',1], min:['Minute',60], h:['Hour',3600], day:['Day',86400], week:['Week',604800], month:['Month (average, 30.44 days)',2629746], year:['Year (365.2425 days)',31556952], ms:['Millisecond',0.001] },
  data: { B:['Byte (B)',1], bit:['Bit',0.125], KB:['Kilobyte (KB, 1000 B)',1e3], MB:['Megabyte (MB, 1000 KB)',1e6], GB:['Gigabyte (GB, 1000 MB)',1e9], TB:['Terabyte (TB, 1000 GB)',1e12], KiB:['Kibibyte (KiB, 1024 B)',1024], MiB:['Mebibyte (MiB, 1024 KiB)',1048576], GiB:['Gibibyte (GiB, 1024 MiB)',1073741824], TiB:['Tebibyte (TiB, 1024 GiB)',1099511627776] },
  area: { sqm:['Square meter',1], sqft:['Square foot',0.09290304], sqyd:['Square yard',0.83612736], acre:['Acre',4046.8564224], ha:['Hectare',10000], sqkm:['Square kilometer',1e6], sqmi:['Square mile',2589988.110336], cm2:['Square centimeter',0.0001] },
  numeral: { dec:['Decimal (base 10)',10], bin:['Binary (base 2)',2], oct:['Octal (base 8)',8], hex:['Hexadecimal (base 16)',16] }
}

function fmtUnit(n) { return (n !== 0 && Math.abs(n) < 1e-6) ? n.toExponential(6).replace(/\.?0+e/, 'e') : formatNumber(n); }

function convertNumeral(raw, fromBase, toBase) {
  let t = String(raw).trim().replace(/[\s_]/g, '').toLowerCase();
  const pre = { 2: '0b', 8: '0o', 16: '0x' }[fromBase];
  if (pre && t.startsWith(pre)) t = t.slice(2);
  const ok = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9a-f]+$/ }[fromBase];
  if (!t) throw new Error('Please enter a number.');
  if (t.length > 64) throw new Error('Number is too long (maximum 64 digits).');
  if (!ok.test(t)) throw new Error('Use only valid digits for the chosen system, whole non-negative numbers only.');
  let n = 0n; const B = BigInt(fromBase);
  for (const ch of t) n = n * B + BigInt(parseInt(ch, 16));
  const out = n.toString(toBase);
  return { shown: t, out: toBase === 16 ? out.toUpperCase() : out };
}

function fillUnits() {
  const cat = document.getElementById('unit-cat').value;
  const keys = Object.keys(UNIT_DATA[cat]);
  ['unit-from','unit-to'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    sel.replaceChildren();
    keys.forEach(k => {
      const o = document.createElement('option');
      o.value = k; o.textContent = UNIT_DATA[cat][k][0];
      sel.appendChild(o);
    });
    sel.selectedIndex = Math.min(idx, keys.length - 1);
  });
  const inp = document.getElementById('unit-val'), isNum = cat === 'numeral';
  inp.value = '';
  inp.type = isNum ? 'text' : 'number';
  inp.setAttribute('inputmode', isNum ? 'text' : 'decimal');
  inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('autocomplete', 'off');
  inp.placeholder = isNum ? 'e.g. 255, 1010 or FF' : 'e.g. 5';
  if (isNum) inp.maxLength = 70; else inp.removeAttribute('maxlength');
}

function calcUnits() {
  runCalc('units-result', () => {
    const cat = document.getElementById('unit-cat').value;
    const from = document.getElementById('unit-from').value, to = document.getElementById('unit-to').value;
    if (cat === 'numeral') {
      const r = convertNumeral(document.getElementById('unit-val').value, UNIT_DATA.numeral[from][1], UNIT_DATA.numeral[to][1]);
      showResult('units-result', `${r.shown.toUpperCase()} (${UNIT_DATA.numeral[from][0]}) =<br>${r.out} (${UNIT_DATA.numeral[to][0]})`);
      return;
    }
    const v = getNumber('unit-val','value',-1e15,1e15);
    let result;
    if (cat === 'temp') {
      let c = from === 'c' ? v : from === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
      if (c < -273.15) throw new Error('Temperature cannot be below absolute zero.');
      result = to === 'c' ? c : to === 'f' ? c * 9 / 5 + 32 : c + 273.15;
    } else {
      result = v * UNIT_DATA[cat][from][1] / UNIT_DATA[cat][to][1];
    }
    showResult('units-result', `${formatNumber(v)} ${UNIT_DATA[cat][from][0]} = ${fmtUnit(result)} ${UNIT_DATA[cat][to][0]}`);
  });
}

function calcLand() {
  runCalc('land-result', () => {
    const v = getNumber('land-val','area',0,1e15);
    const marla = Number(document.getElementById('land-marla').value);
    const sqft = { marla: marla, kanal: marla*20, acre: 43560, sqft: 1, sqyd: 9, sqm: 10.7639104167 };
    const names = { marla: 'Marla', kanal: 'Kanal', acre: 'Acre', sqft: 'Square feet', sqyd: 'Square yards (gaz)', sqm: 'Square meters' };
    const from = document.getElementById('land-from').value;
    const base = v * sqft[from];
    const lines = Object.keys(sqft).filter(k => k !== from).map(k => `${names[k]}: ${formatNumber(base / sqft[k])}`);
    showResult('land-result', `${formatNumber(v)} ${names[from]} =<br>` + lines.join('<br>'));
  });
}
