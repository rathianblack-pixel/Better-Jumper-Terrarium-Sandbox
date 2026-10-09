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
  // v1.2: species specialities, behaviour polish and the life cycle
  ADD.push(
    ['boxing', 'species', 'Boxing Match', 'A boxer mantis pumped its banded forelegs up and down at a neighbour, like a tiny boxer sparring.', 'Boxer mantis: bring your finger close, or keep two in one tank.'],
    ['wingBuzz', 'species', 'Wing Buzz', 'A budwing mantis flicked its stubby wings so fast they rattled, flashing orange underneath.', 'Budwing mantis: startle it gently with your finger.'],
    ['barkSprint', 'species', 'Bark Sprinter', 'A bark mantis dashed across a trunk in a quick burst, then froze flat against it.', 'Bark mantis: give it a bark slab, trunk or cork to run on.'],
    ['stickFlat', 'species', 'Just a Twig', 'A stick mantis lay flat along a twig, forelegs stretched out ahead, and disappeared into it.', 'Stick mantis: give it thin twigs and stems.'],
    ['playDead', 'species', 'Playing Dead', 'Startled, a dead leaf mantis dropped flat and lay still as a fallen leaf until the danger passed.', 'Dead leaf mantis: give it a fright.'],
    ['violinFlyer', 'species', 'Only Things That Fly', 'A wandering violin mantis ignored everything that walked and snatched a flying insect out of the air.', 'Violin mantis: offer flies or moths.'],
    ['giantStare', 'species', 'Face to Face', 'A giant Asian mantis walked up to the glass and stared straight back at you.', 'Giant Asian mantis: hold your finger still on the glass.'],
    ['flowerDisplay', 'species', 'The Devil\u2019s Flower', 'A devil\u2019s flower mantis spread its leafy forelegs wide and showed the red, blue and purple hidden inside.', 'Devil\u2019s flower mantis: startle it, or let another mantis come too close.'],
    ['flowerHang', 'species', 'Swaying Bloom', 'A flower mantis hung upside-down from a high tip and swayed gently, like a bloom on its stem.', 'Devil\u2019s flower or violin mantis: give it tall tips to hang from.'],
    ['missedStrike', 'hunt', 'Missed!', 'A strike shot out and closed on nothing: the prey was faster. The mantis paused, then settled back to wait.', 'Fast flyers and young nymphs make misses more likely.'],
    ['peering', 'hunt', 'Measuring the Distance', 'Before striking, a mantis rocked its head from side to side to judge how far away its prey was.', 'Watch closely just before a strike.'],
    ['nightShift', 'hunt', 'Night Shift', 'A night-active mantis hunted a moth after dark while the others slept.', 'Ghost, dead leaf, violin and devil\u2019s flower mantises stay up at dusk.'],
    ['breezeSway', 'life', 'In the Breeze', 'When the breeze came through, a mantis rocked in time with its stem, just like a leaf.', 'A breezy biome (Prairie, Heath, Dry Leaf) brings the wind.'],
    ['eyeWipe', 'life', 'Clean Eyes', 'A mantis drew a foreleg over each big eye to wipe it clean.', 'Watch a resting mantis for a while.'],
    ['beadSip', 'life', 'A Tiny Bead', 'A nymph lowered its head and sipped from one of the smallest water beads.', 'Mist the tank while nymphs are about.'],
    ['morningBask', 'life', 'Morning Warm-up', 'In the morning a mantis settled under the warm lamp; its colours brightened as it warmed up.', 'Add a basking lamp and watch at sunrise.'],
    ['colourShift', 'grow', 'New Colours', 'After a molt, a mantis came out in colours closer to its surroundings.', 'Chinese, European, Carolina, ghost, dead leaf, stick and giant Asian mantises can change colour when they molt.'],
    ['courtship', 'social', 'Courtship', 'A male mantis crept up on a female from behind, very slowly, freezing whenever she turned her head.', 'Keep an adult male and female of the same species together.'],
    ['mating', 'social', 'A Pair', 'The male climbed onto the female\u2019s back and the two stayed together for a long while.', 'Let a courting male reach the female.'],
    ['eatenByMate', 'social', 'Eaten by His Mate', 'The female turned round and ate the male. It happens, especially when she is hungry.', 'Mate a hungry female (or just be unlucky).'],
    ['oothLaid', 'grow', 'Egg Case', 'A female worked a foamy egg case onto a high twig with the tip of her abdomen.', 'Some time after mating, the female lays.'],
    ['oothHard', 'grow', 'Hardened', 'The pale, soft egg case dried to a tough, dark shell.', 'Wait a day after the egg case is laid.'],
    ['hatchDay', 'grow', 'Hatching Day', 'Dozens of tiny nymphs streamed out of the egg case, dangled for a moment, then scattered.', 'Keep the egg case for a few days.'],
    ['elder', 'life', 'Old Age', 'An old adult has slowed down; its strikes are slower and its colours a little faded.', 'Keep an adult for a long time.'],
  );
  for (const [id, cat, title, text, hint] of ADD) { if (!JT.JOURNAL.some(e => e.id === id)) JT.JOURNAL.push({ id, title, icon: '', text }); JT.JOURNAL_META[id] = [cat, hint]; }
})(typeof window !== 'undefined' ? window : globalThis);
(function (root) {
  const JT = root.JT; if (!JT || !JT.Habitat || !JT.MANTIS_JDROP) return;
  const ev0 = JT.Habitat.prototype.event;
  JT.Habitat.prototype.event = function (type, info) { if (type === 'journal' && info && JT.MANTIS_JDROP.has(info.id)) return; return ev0.call(this, type, info); };
})(typeof window !== 'undefined' ? window : globalThis);
