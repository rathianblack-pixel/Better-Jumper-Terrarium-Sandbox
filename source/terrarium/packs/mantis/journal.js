/* Mantis Terrarium pack — field journal: spider-only entries removed, the rest reworded for mantises,
   plus mantis behaviours (flight, threat display, eaten alive, leftovers, grooming, hanging molt, specialities). */
(function (root) {
  const JT = root.JT; if (!JT || !JT.JOURNAL) return;
  const DROP = new Set(['retreat', 'safety', 'dangle', 'portiaDetour', 'antMarch', 'antFooled', 'giantLeap', 'nectarSip', 'semaphore', 'prismDisplay', 'glassGhost', 'emberNight', 'titanLeap', 'grandFinale', 'display', 'tinyEscape', 'tinyCatch']);
  JT.JOURNAL = JT.JOURNAL.filter(e => !DROP.has(e.id)); JT.MANTIS_JDROP = DROP;
  for (const id of DROP) delete JT.JOURNAL_META[id];
  const TXT = {
    firstHunt: 'A mantis waited, struck with its spined forelegs and held its first meal in your habitat.',
    ambushHigh: 'A mantis struck down at prey passing below its perch.',
    ambushCover: 'A mantis waited motionless among leaves until prey walked into reach.',
    stepping: 'A mantis picked its way across several perches to close in on prey.',
    safeMeal: 'Disturbed while eating, a mantis carried its catch off to a quieter perch.',
    drink: 'A thirsty mantis sipped a droplet from a leaf.',
    molt: 'A mantis hung beneath a perch, split its old skin and slid out a stage bigger.',
    investigate: 'A mantis swivelled its head to study something newly placed in its habitat.',
    territorial: 'Two mantises faced off: forelegs raised, wings flared.',
    cannibal: 'A mantis caught and ate its tank-mate. Mantises are not sociable animals.',
    softMolt: 'A freshly molted mantis hung pale and soft while its new skin hardened.',
    adult: 'A mantis completed its final molt and now has full wings.',
    veteran: 'A mantis has lived a long, full adult life in your care.',
    intercept: 'A mantis tracked a flying insect with its head and struck as it came past.',
    bask: 'A mantis settled in the warm pool of a basking lamp.',
    restless: 'With nothing left to hunt, a hungry mantis prowled its perches, head turning at every movement.',
    bigPrey: 'A hungry mantis grabbed prey nearly as big as itself.',
    shakenOff: 'A big catch kicked free of a mantis\u2019s grip and got away.',
    giantMeal: 'A mantis held on to a huge, struggling catch and ate it anyway.',
    fingerCurious: 'A mantis turned its head to follow your fingertip on the glass.',
    fingerShy: 'Startled by your finger, a mantis flared its wings and reared up, then backed away.',
    finishWeak: 'A mantis snatched a weakened escapee before it could recover.',
  };
  for (const e of JT.JOURNAL) if (TXT[e.id]) e.text = TXT[e.id];
  Object.assign(JT.JOURNAL_META, {
    safeMeal: ['hunt', 'Disturb a feeding mantis (a tap on the glass, or move the decor).'],
    molt: ['grow', 'Well-fed nymphs molt after a few meals; give them open space under a perch.'],
    territorial: ['social', 'Two mantises in one tank may square up.'],
    cannibal: ['social', 'Hungry mantises sharing a tank may eat each other.'],
    fingerShy: ['you', 'Some mantises do not like a finger close by.'],
  });
  const ADD = [
    ['eatenAlive', 'hunt', 'Eaten Alive', 'A mantis started eating its catch while it was still kicking. It does not wait for the prey to die.', 'Watch a mantis right after it catches something.'],
    ['leftovers', 'hunt', 'Leftovers', 'Wings, legs and other hard bits dropped to the floor one by one while the mantis ate.', 'Watch a mantis eat a fly, moth or cricket from start to finish.'],
    ['mantisGroom', 'life', 'Clean Forelegs', 'After eating, a mantis drew each foreleg through its jaws and wiped its face clean.', 'Watch a mantis finish a meal.'],
    ['hangMolt', 'grow', 'Hanging Molt', 'A nymph molted upside-down under a perch and left its empty skin hanging there.', 'Give nymphs a twig or cross-perch with open air below.'],
    ['mantisFlight', 'life', 'Short Flight', 'An adult mantis opened its wings and flew a short hop across the tank.', 'Adults with full wings sometimes fly between perches.'],
    ['mantisThreat', 'social', 'Threat Display', 'A mantis reared up, flared its wings and raised its forelegs wide to look bigger.', 'Startle a mantis, or put two in one tank.'],
    ['flowerLure', 'species', 'Waiting in the Flowers', 'An orchid or spiny flower mantis caught a visitor while sitting on a flower.', 'Orchid and spiny flower mantises: give them flowers to sit on.'],
    ['camoHunt', 'species', 'Hidden in Plain Sight', 'A bark or dead-leaf mantis hunted from its home woodland, almost invisible against it.', 'Ghost and Carolina mantises: keep them in Dry Leaf or Old Bark Forest.'],
  ];
  for (const [id, cat, title, text, hint] of ADD) { if (!JT.JOURNAL.some(e => e.id === id)) JT.JOURNAL.push({ id, title, icon: '', text }); JT.JOURNAL_META[id] = [cat, hint]; }
})(typeof window !== 'undefined' ? window : globalThis);
(function (root) {
  const JT = root.JT; if (!JT || !JT.Habitat || !JT.MANTIS_JDROP) return;
  const ev0 = JT.Habitat.prototype.event;
  JT.Habitat.prototype.event = function (type, info) { if (type === 'journal' && info && JT.MANTIS_JDROP.has(info.id)) return; return ev0.call(this, type, info); };
})(typeof window !== 'undefined' ? window : globalThis);
