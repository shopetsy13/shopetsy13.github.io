/* Age calculator page. Runs only in the browser; nothing is stored or sent. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var out = $('age-result');

  /* Exact years, months and days between two dates (birth -> target). */
  function ageParts(birth, target) {
    var y = target.getFullYear() - birth.getFullYear();
    var m = target.getMonth() - birth.getMonth();
    var d = target.getDate() - birth.getDate();
    if (d < 0) { m--; d += new Date(target.getFullYear(), target.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return { years: y, months: m, days: d };
  }
  function parse(v) {
    var p = String(v || '').split('-');
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  /* Main calculation. "today" can be passed in for testing. */
  window.ageCalc = function (dobText, today) {
    var birth = parse(dobText);
    if (!birth) throw new Error('Please enter a valid date of birth.');
    var now = today ? parse(today) : new Date(); now = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (birth > now) throw new Error('Date of birth cannot be in the future.');
    if (now.getFullYear() - birth.getFullYear() > 150) throw new Error('Please check the year of birth.');
    var a = ageParts(birth, now);
    var days = Math.round((now - birth) / 86400000);
    var next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    if (next < now) next = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
    var toBirthday = Math.round((next - now) / 86400000);
    return {
      lines: [
        'Age: ' + plural(a.years, 'year') + ', ' + plural(a.months, 'month') + ', ' + plural(a.days, 'day'),
        'Total days: ' + fmt(days),
        'Total weeks: ' + fmt(Math.floor(days / 7)),
        'Next birthday in: ' + fmt(toBirthday) + (toBirthday === 1 ? ' day' : ' days') + (toBirthday === 0 ? ' (today!)' : '')
      ]
    };
  };

  function calc() {
    try {
      var r = window.ageCalc($('age-dob').value, null);
      out.replaceChildren();
      r.lines.forEach(function (line, i) {
        if (i) out.appendChild(document.createElement('br'));
        var s = document.createElement('span'); s.textContent = line; out.appendChild(s);
      });
      out.style.display = 'block';
    } catch (e) {
      out.textContent = e.message || 'Please check your input.';
      out.style.display = 'block';
    }
  }
  $('age-btn').addEventListener('click', calc);
})();
