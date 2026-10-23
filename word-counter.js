/* Word and character counter. Runs only in the browser; the text is never stored or sent. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var box = $('wc-text'), speed = $('wc-speed'), sel = $('wc-template');
  var TEMPLATES = {
    en: 'Education is the fundamental pillar for the development of any society. In the digital age, its importance has increased even more because access to knowledge has become extremely easy and fast.',
    ur: 'تعلیم کسی بھی معاشرے کی ترقی کی بنیادی ستون ہے۔ ڈیجیٹل دور میں علم تک رسائی آسان ہو گئی ہے، اس لیے اس کی اہمیت مزید بڑھ گئی ہے؟'
  };

  function analyse(t) {
    var trimmed = t.trim();
    var list = trimmed ? trimmed.split(/\s+/) : [];
    var urdu = 0, english = 0;
    list.forEach(function (w) {
      if (/[\u0600-\u06FF]/.test(w)) urdu++;
      else if (/[A-Za-z]/.test(w)) english++;
    });
    var sentences = trimmed ? (trimmed.match(/[.!?۔؟]+(\s|$)/g) || []).length || 1 : 0;
    var paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(function (p) { return p.trim(); }).length : 0;
    return {
      words: list.length, urdu: urdu, english: english,
      chars: t.length, noSpaces: t.replace(/\s/g, '').length,
      sentences: sentences, paragraphs: paragraphs,
      avg: sentences ? Math.round(list.length / sentences) : 0
    };
  }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function readText(words, wpm) {
    var sec = words / wpm * 60;
    if (sec < 1) return '0 sec';
    if (sec < 60) return Math.round(sec) + ' sec';
    return (sec / 60).toFixed(1) + ' min';
  }
  function setText(id, text) { $(id).textContent = text; }

  function render() {
    var s = analyse(box.value), wpm = Number(speed.value);
    setText('wc-speed-label', wpm + ' WPM');
    setText('wc-words', fmt(s.words));
    setText('wc-words-sub', fmt(s.urdu) + ' Urdu • ' + fmt(s.english) + ' English');
    setText('wc-chars', fmt(s.chars));
    setText('wc-chars-sub', 'No spaces: ' + fmt(s.noSpaces));
    setText('wc-sentences', fmt(s.sentences));
    setText('wc-sentences-sub', 'Avg. words/sentence: ' + s.avg);
    setText('wc-paragraphs', fmt(s.paragraphs));
    setText('wc-paragraphs-sub', 'Read time: ' + readText(s.words, wpm));
    setText('wc-speak', 'Speaking time (130 WPM): ' + readText(s.words, 130));
  }

  box.addEventListener('input', render);
  speed.addEventListener('input', render);
  sel.addEventListener('change', function () {
    var v = sel.value;
    if (TEMPLATES[v]) box.value = TEMPLATES[v];
    sel.value = '';
    render();
  });
  $('wc-clear').addEventListener('click', function () { box.value = ''; render(); box.focus(); });
  render();
})();
