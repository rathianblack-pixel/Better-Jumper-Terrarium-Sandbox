/* Jumper Terrarium — static content definitions (no runtime state). */
(function (root) {
  'use strict';
  const JT = root.JT;

  // ---------------- Habitat (enclosure) types ----------------
  JT.HABITATS = {
    standard:  { name: 'Standard Terrarium', w: 200, d: 90,  h: 100, cap: 3, shape: 'rect',   price: 250 },
    arboreal:  { name: 'Tall Arboreal',      w: 150, d: 78,  h: 150, cap: 3, shape: 'rect',   price: 300 },
    wide:      { name: 'Wide Display',       w: 270, d: 82,  h: 88,  cap: 4, shape: 'rect',   price: 350 },
    nano:      { name: 'Nano Cube',          w: 118, d: 68,  h: 82,  cap: 1, shape: 'rect',   price: 120 },
    cube:      { name: 'Large Cube',         w: 165, d: 132, h: 145, cap: 4, shape: 'rect',   price: 450 },
    breeder:   { name: 'Acrylic Breeder',    w: 135, d: 72,  h: 96,  cap: 2, shape: 'rect',   price: 160 },
    panoramic: { name: 'Panoramic Habitat',  w: 310, d: 98,  h: 112, cap: 4, shape: 'rect',   price: 600 },
    jar:       { name: 'Tall Display Jar',   w: 132, d: 132, h: 155, cap: 2, shape: 'circle', price: 380 },
    tower:     { name: 'Vertical Tower',     w: 100, d: 84,  h: 172, cap: 2, shape: 'rect',   price: 280, tall: true },
  };
  JT.SLOT_PRICES = [0, 0, 0, 400, 600, 850, 1100, 1400];

  // ---------------- Substrates ----------------
  // burrow: 0..1 plausibility for burrowing prey; moist: base dampness
  JT.SUBSTRATES = {
    desert:  { name: 'Desert Sand',      price: 0,  top: '#d9b77e', mid: '#c49a5c', dark: '#9a7440', speck: ['#f0d6a2', '#b98e55'], burrow: 0.9, moist: 0.1 },
    coco:    { name: 'Coco Soil',        price: 0,  top: '#6b4529', mid: '#4f321d', dark: '#352113', speck: ['#8a5c3a', '#3b2516'], burrow: 1.0, moist: 0.5 },
    moss:    { name: 'Moss Bed',         price: 30, top: '#5b7a34', mid: '#3f5524', dark: '#2a3a18', speck: ['#7fa048', '#45602a'], burrow: 0.4, moist: 0.8 },
    clay:    { name: 'Red Clay',         price: 20, top: '#a5583a', mid: '#87432a', dark: '#5e2d1c', speck: ['#c06b48', '#743722'], burrow: 0.5, moist: 0.3 },
    gravel:  { name: 'River Gravel',     price: 25, top: '#8f8a80', mid: '#6d685f', dark: '#4b4740', speck: ['#b3ada2', '#5d5850', '#a39486'], burrow: 0.05, moist: 0.2, pebbly: true },
    beach:   { name: 'Pale Beach Sand',  price: 20, top: '#e6d5b0', mid: '#cdb98f', dark: '#a8946b', speck: ['#f6ead0', '#c7ae80'], burrow: 0.85, moist: 0.15 },
    forest:  { name: 'Forest Floor Mix', price: 30, top: '#5a3e26', mid: '#432d1b', dark: '#2c1d11', speck: ['#7a5634', '#8a6a3a', '#3a2a17'], burrow: 0.8, moist: 0.6, litter: true },
    black:   { name: 'Rich Black Soil',  price: 25, top: '#3a2c22', mid: '#2a1f18', dark: '#1a130e', speck: ['#4e3c2e', '#21180f'], burrow: 1.0, moist: 0.55 },
    sphagnum:{ name: 'Sphagnum Carpet',  price: 40, top: '#9aa65a', mid: '#6d7a3b', dark: '#46502a', speck: ['#c0c47c', '#7d8c44'], burrow: 0.35, moist: 0.95 },
    lime:    { name: 'Limestone Grit',   price: 25, top: '#cfc8b6', mid: '#aea694', dark: '#857e6d', speck: ['#e8e2d2', '#9c9584'], burrow: 0.2, moist: 0.1, pebbly: true },
    jungle:  { name: 'Jungle Floor',     price: 45, top: '#4a3a1e', mid: '#382b16', dark: '#241b0d', speck: ['#6b5a2a', '#5b7a34', '#7a4f2a'], burrow: 0.75, moist: 0.8, litter: true },
  };

  // ---------------- Natural backgrounds ----------------
  JT.BACKGROUNDS = {
    hollow:   { name: 'Ancient Tree Hollow', sky: ['#2b1d12', '#4a3320', '#6b4a2c'], blobs: ['#3a2716', '#5a3d22', '#7a5530', '#2a3a1a'], light: '#ffd08a', shafts: 0.35 },
    mossy:    { name: 'Mossy Forest Floor',  sky: ['#1e2b17', '#2f4222', '#46602d'], blobs: ['#2a3d1c', '#3f5a28', '#5c7a36', '#6e8a40'], light: '#e6f0a0', shafts: 0.3 },
    meadow:   { name: 'Sunlit Meadow',       sky: ['#8fb3c9', '#c4d6a6', '#9cb86a'], blobs: ['#7fa050', '#a8c070', '#e8e0a0', '#c9d98a', '#f2d06a'], light: '#fff3c0', shafts: 0.5 },
    canopy:   { name: 'Rainforest Canopy',   sky: ['#16301f', '#24502f', '#3b7040'], blobs: ['#1f4a28', '#2f6a36', '#4c8a44', '#88b860'], light: '#d8ffb0', shafts: 0.55 },
    twilight: { name: 'Twilight Woodland',   sky: ['#1b1a33', '#3a3352', '#6a4d5e'], blobs: ['#2c2a48', '#4a3f5e', '#7a5a6a', '#c08a6a'], light: '#ffc8a0', shafts: 0.25 },
    stone:    { name: 'Moss Stone Garden',   sky: ['#2c3330', '#46504a', '#68736a'], blobs: ['#56605a', '#3e4a40', '#6e8a54', '#8a948c'], light: '#eef6e0', shafts: 0.3 },
    log:      { name: 'Fallen Log Interior', sky: ['#24170e', '#3c2716', '#5a3b20'], blobs: ['#4a3018', '#6a4524', '#2e2010', '#8a6a3a'], light: '#ffb870', shafts: 0.45 },
  };

  // ---------------- Spider species ----------------
  // len: adult body length (habitat units ~ mm). traits: baseline 0..1.
  // prefs: height (elevation), foliage, rear (rear approach value), display, activity.
  const S = (id, name, sci, len, price, pal, pattern, traits, prefs, desc, extra) =>
    Object.assign({ id, name, sci, len, price, pal, pattern, traits, prefs, desc }, extra || {});
  JT.SPECIES = [
    S('bold', 'Bold Jumper', 'Phidippus audax', 13, 0, { ceph: '#1b1b1d', abd: '#151517', mark: '#f4f1ea', leg: '#222', chel: '#2fd07a', hair: '#3a3a3a', belly: '#4a4a4a' }, 'bold',
      { stealth: .5, patience: .45, jump: .75, bold: .9, tactics: .55 }, { height: .5, foliage: .4, rear: .3, display: .2, activity: .6 },
      'Fearless and adaptable. Bold Jumpers take on substantial prey and settle quickly into any layout.', { starter: true }),
    S('regal', 'Regal Jumper', 'Phidippus regius (sling)', 15, 0, { ceph: '#7a5a3a', abd: '#8a6a44', mark: '#e8d6b0', leg: '#6a4e34', chel: '#3fbf7a', hair: '#a88a60', belly: '#9a8060' }, 'regal',
      { stealth: .55, patience: .8, jump: .7, bold: .7, tactics: .6 }, { height: .55, foliage: .45, rear: .35, display: .2, activity: .4 },
      'A patient observer. Young regals are tan and fuzzy and spend long minutes watching before committing.', { starter: true }),
    S('canopy', 'Canopy Jumper', 'Phidippus otiosus', 10, 0, { ceph: '#7a6a5a', abd: '#c46a2a', mark: '#f0d090', leg: '#8a7a6a', chel: '#8a3ab0', hair: '#b0a090', belly: '#9a8a7a' }, 'canopy',
      { stealth: .6, patience: .6, jump: .75, bold: .6, tactics: .6 }, { height: .95, foliage: .85, rear: .4, display: .2, activity: .55 },
      'Lives high in trees. Strongly prefers elevation and foliage and rarely lingers on the ground.', { starter: true }),
    S('zebra', 'Zebra Jumper', 'Salticus scenicus', 6, 90, { ceph: '#1a1a1a', abd: '#1a1a1a', mark: '#f2f2ee', leg: '#3a3a3a', chel: '#333', hair: '#ddd', belly: '#555' }, 'zebra',
      { stealth: .5, patience: .35, jump: .65, bold: .55, tactics: .45 }, { height: .5, foliage: .2, rear: .25, display: .1, activity: .9 },
      'An energetic surface runner that patrols stone and bark faces in quick bursts.'),
    S('graywall', 'Gray Wall Jumper', 'Menemerus bivittatus', 9, 110, { ceph: '#6a6660', abd: '#7a756c', mark: '#d8d2c4', leg: '#77726a', chel: '#555', hair: '#a8a296', belly: '#8a857c' }, 'graywall',
      { stealth: .7, patience: .75, jump: .7, bold: .55, tactics: .55 }, { height: .45, foliage: .1, rear: .35, display: .1, activity: .4 },
      'A flattened ambush hunter of vertical surfaces. Waits motionless, then strikes fast.'),
    S('pantropical', 'Pantropical Jumper', 'Plexippus paykulli', 11, 120, { ceph: '#2a2420', abd: '#3a2e24', mark: '#d9c9a8', leg: '#5a4a3a', chel: '#4a3a2a', hair: '#8a7a64', belly: '#6a5a4a' }, 'pantropical',
      { stealth: .5, patience: .45, jump: .7, bold: .75, tactics: .5 }, { height: .35, foliage: .2, rear: .25, display: .15, activity: .8 },
      'A confident patrol hunter that covers ground quickly and engages readily.'),
    S('arc', 'Arc Jumper', 'Evarcha arcuata', 7, 100, { ceph: '#3a2a1e', abd: '#4a3624', mark: '#e8dcc0', leg: '#5a4430', chel: '#3a2a1e', hair: '#c8b494', belly: '#6a5440' }, 'arc',
      { stealth: .55, patience: .45, jump: .7, bold: .6, tactics: .55 }, { height: .55, foliage: .7, rear: .3, display: .2, activity: .75 },
      'An active meadow stalker that hunts through grasses and flowering plants.'),
    S('emerald', 'Emerald Jumper', 'Paraphidippus aurantius', 8, 160, { ceph: '#1a2a24', abd: '#1e6a4a', mark: '#f0a040', leg: '#3a5a4a', chel: '#2ad0a0', hair: '#7ac0a0', belly: '#2a4a3a' }, 'emerald',
      { stealth: .6, patience: .5, jump: .7, bold: .6, tactics: .55 }, { height: .7, foliage: .85, rear: .3, display: .25, activity: .6 },
      'Iridescent green and fond of foliage. Hunts from leaf surfaces.'),
    S('peacock', 'Peacock Spider', 'Maratus volans', 4.5, 220, { ceph: '#3a2a20', abd: '#2a60c0', mark: '#e04a2a', leg: '#5a4030', chel: '#3a2a20', hair: '#c0a080', belly: '#5a4a3a' }, 'peacock',
      { stealth: .55, patience: .45, jump: .6, bold: .45, tactics: .5 }, { height: .35, foliage: .3, rear: .25, display: .95, activity: .65 },
      'Tiny and theatrical. Raises its iridescent fan and waves its legs in elaborate displays.'),
    S('twinflag', 'Twin-flagged Jumper', 'Anasaitis canosa', 6, 140, { ceph: '#2a2018', abd: '#3a2a1e', mark: '#f4f0e0', leg: '#4a3a2a', chel: '#2a2018', hair: '#d8d0c0', belly: '#5a4a3a' }, 'twinflag',
      { stealth: .8, patience: .7, jump: .65, bold: .35, tactics: .75 }, { height: .3, foliage: .3, rear: .85, display: .3, activity: .55 },
      'A cautious specialist that strongly favors approaching from behind.'),
    S('putnam', "Putnam's Jumper", 'Phidippus putnami', 11, 170, { ceph: '#2a2018', abd: '#5a3a24', mark: '#e8c890', leg: '#4a3626', chel: '#3ab07a', hair: '#a07a50', belly: '#6a5040' }, 'putnam',
      { stealth: .65, patience: .8, jump: .7, bold: .6, tactics: .6 }, { height: .6, foliage: .5, rear: .4, display: .15, activity: .45 },
      'A patient woodland hunter, unhurried and deliberate.'),
    S('cardinal', 'Cardinal Jumper', 'Phidippus cardinalis', 10, 200, { ceph: '#1a1010', abd: '#d42a1e', mark: '#ff6a4a', leg: '#2a1a18', chel: '#3aa0d0', hair: '#e04a30', belly: '#3a2020' }, 'red',
      { stealth: .5, patience: .45, jump: .75, bold: .8, tactics: .5 }, { height: .45, foliage: .35, rear: .25, display: .2, activity: .65 },
      'Brilliant red and direct. Prefers a confident, straightforward hunt.'),
    S('apache', 'Apache Jumper', 'Phidippus apacheanus', 13, 230, { ceph: '#141010', abd: '#e86a1a', mark: '#ffb050', leg: '#1e1612', chel: '#30c080', hair: '#ff8a30', belly: '#2a1e18' }, 'red',
      { stealth: .5, patience: .5, jump: .75, bold: .85, tactics: .5 }, { height: .45, foliage: .35, rear: .25, display: .2, activity: .6 },
      'Large orange-red jumper with a direct, confident hunting style.'),
    S('johnson', "Johnson's Jumper", 'Phidippus johnsoni', 11, 210, { ceph: '#121212', abd: '#c8201e', mark: '#1a1a1a', leg: '#1e1e1e', chel: '#2ab0c8', hair: '#d03028', belly: '#2a2020' }, 'johnson',
      { stealth: .5, patience: .45, jump: .75, bold: .8, tactics: .5 }, { height: .4, foliage: .3, rear: .25, display: .2, activity: .65 },
      'Red-backed and bold. Rarely hesitates once prey is in view.'),
    S('imperial', 'Imperial Jumper', 'Thyene imperialis', 7, 240, { ceph: '#4a3a1a', abd: '#3aa0a0', mark: '#e8c040', leg: '#6a5a3a', chel: '#4a3a1a', hair: '#c0a050', belly: '#5a4a2a' }, 'imperial',
      { stealth: .6, patience: .65, jump: .7, bold: .55, tactics: .6 }, { height: .65, foliage: .75, rear: .35, display: .35, activity: .5 },
      'A measured foliage hunter with metallic scales.'),
    S('magnolia', 'Magnolia Green Jumper', 'Lyssomanes viridis', 7.5, 260, { ceph: '#9adf8a', abd: '#8ad07a', mark: '#e05a3a', leg: '#b8f0a8', chel: '#9adf8a', hair: '#d8ffc8', belly: '#a8e898' }, 'magnolia',
      { stealth: .65, patience: .55, jump: .7, bold: .45, tactics: .55 }, { height: .9, foliage: .95, rear: .3, display: .2, activity: .55 }, 
      'Translucent green and long-legged. Lives almost entirely on elevated leaves.', { translucent: true }),
    S('ant', 'Ant Mimic', 'Myrmarachne sp.', 6.5, 250, { ceph: '#1a1410', abd: '#2a1e16', mark: '#4a3a2a', leg: '#2a2018', chel: '#3a2a20', hair: '#3a2e24', belly: '#3a2e24' }, 'ant',
      { stealth: .85, patience: .65, jump: .55, bold: .4, tactics: .7 }, { height: .35, foliage: .35, rear: .8, display: .1, activity: .7 },
      'Disguised as an ant. Moves in a twitchy low-profile way and approaches from behind.', { antShape: true }),
    S('paradise', 'Paradise Jumper', 'Habronattus pyrrithrix', 6.5, 230, { ceph: '#3a3028', abd: '#5a4a3a', mark: '#e0d0b0', leg: '#6a5a4a', chel: '#d03a2a', hair: '#9a8a7a', belly: '#6a5a4a' }, 'paradise',
      { stealth: .55, patience: .5, jump: .65, bold: .5, tactics: .5 }, { height: .3, foliage: .3, rear: .3, display: .8, activity: .65 },
      'Known for vivid red faces and energetic courtship displays.'),
    S('giant', 'Giant Jumper', 'Hyllus diardi', 16, 380, { ceph: '#4a3a2a', abd: '#5a4632', mark: '#d8c09a', leg: '#5a4836', chel: '#3a2a1e', hair: '#b09a7a', belly: '#6a5644' }, 'giant',
      { stealth: .55, patience: .7, jump: .8, bold: .95, tactics: .6 }, { height: .55, foliage: .45, rear: .3, display: .15, activity: .4 },
      'A powerful, deliberate hunter that can tackle very large prey.'),
    S('portia', 'Portia', 'Portia fimbriata', 9, 0, { ceph: '#4a3a28', abd: '#5a4834', mark: '#c8b08a', leg: '#5a4632', chel: '#3a2a1e', hair: '#a8906a', belly: '#6a5844' }, 'portia',
      { stealth: .95, patience: .95, jump: .75, bold: .7, tactics: 1.0 }, { height: .6, foliage: .55, rear: .95, display: .1, activity: .45 },
      'The most calculating jumper. Plans indirect routes, exploits cover and attacks from behind.', { unlockCatches: 30 }),
    S('orange', 'Regal Orange Morph', 'Phidippus regius (adult female)', 19, 450, { ceph: '#2a1e14', abd: '#e0701e', mark: '#fff0d8', leg: '#3a2a1c', chel: '#2ad08a', hair: '#ff9a40', belly: '#4a3424' }, 'orange',
      { stealth: .6, patience: .85, jump: .75, bold: .9, tactics: .65 }, { height: .55, foliage: .45, rear: .35, display: .15, activity: .35 },
      'A mature, powerful but patient hunter. The largest and most imposing in the collection.', { minStage: 5 }),
  ];
  JT.SPECIES_BY_ID = {}; JT.SPECIES.forEach(s => JT.SPECIES_BY_ID[s.id] = s);

  JT.STAGES = ['Tiny Sling', 'Sling', 'Juvenile', 'Sub-adult', 'Young Adult', 'Adult'];
  JT.STAGE_SCALE = [0.28, 0.4, 0.55, 0.72, 0.88, 1.0];

  JT.NAMES = ['Pip', 'Biscuit', 'Bean', 'Mochi', 'Pebble', 'Fuzz', 'Bolt', 'Peanut', 'Juniper', 'Nugget', 'Pepper', 'Sprout', 'Hopper', 'Boba', 'Tofu', 'Clover', 'Mango', 'Ziggy', 'Pixel', 'Noodle', 'Button', 'Olive', 'Kiwi', 'Toast', 'Sesame', 'Maple', 'Waffle', 'Ember', 'Dot', 'Velvet'];

  // ---------------- Prey ----------------
  // len (units), nut (satiety gain), val (coins), spd, sense (awareness radius), reflex (0..1), struggle (s)
  // loco flags: fly, hop, burrow, climb (decor climbing), hide, slow, land (can land on plants)
  const P = (id, name, shape, o) => Object.assign({ id, name, shape, huntable: true, danger: 0, night: 0, count: 1, cover: 0, moist: 0 }, o);
  JT.PREY = [
    P('fruitfly', 'Fruit Flies', 'fly', { len: 2.5, nut: .12, val: 4, spd: 14, sense: 18, reflex: .35, struggle: 1.0, fly: true, land: true, price: 10, count: 5, col: '#b08a40', eye: '#c0201a', flowers: .4 }),
    P('housefly', 'House Fly', 'fly', { len: 7, nut: .3, val: 12, spd: 34, sense: 40, reflex: .6, struggle: 3.0, fly: true, land: true, price: 18, col: '#3a3a3a', eye: '#8a1a10', flowers: .5 }),
    P('bluebottle', 'Bluebottle', 'fly', { len: 9, nut: .38, val: 16, spd: 38, sense: 44, reflex: .6, struggle: 3.5, fly: true, land: true, price: 24, col: '#1f4a8a', eye: '#a01a10', metallic: true, flowers: .6, danger: .1 }),
    P('moth', 'Moth', 'moth', { len: 10, nut: .4, val: 16, spd: 24, sense: 30, reflex: .4, struggle: 3.5, fly: true, land: true, price: 22, col: '#a89070', night: .9, flowers: .7 }),
    P('cricket', 'Crickets', 'cricket', { len: 13, nut: .5, val: 18, spd: 20, sense: 34, reflex: .55, struggle: 4.5, hop: true, hide: true, price: 15, count: 2, col: '#6a4a2a', danger: .35 }),
    P('mealworm', 'Mealworms', 'worm', { len: 14, nut: .45, val: 12, spd: 4, sense: 10, reflex: .05, struggle: 3.0, burrow: true, slow: true, price: 12, count: 3, col: '#c89a4a', segs: 12 }),
    P('dubia', 'Dubia Nymphs', 'roach', { len: 9, nut: .4, val: 14, spd: 16, sense: 24, reflex: .4, struggle: 3.5, climb: true, hide: true, price: 16, count: 2, col: '#4a2e1c', danger: .2 }),
    P('tinyjumper', 'Tiny Jumper', 'spider', { len: 4.5, nut: .3, val: 22, spd: 18, sense: 40, reflex: .4, struggle: 3.0, climb: true, hop: true, price: 30, col: '#3a2a20' }),
    P('springtail', 'Springtail Colony', 'springtail', { len: 1.2, nut: 0, val: 0, spd: 8, sense: 8, reflex: .5, struggle: .5, climb: true, huntable: false, cleaner: true, price: 15, count: 6, col: '#d8d8e0', moist: 1 }),
    P('isopod', 'Dwarf Isopods', 'isopod', { len: 4, nut: 0, val: 0, spd: 5, sense: 10, reflex: .1, struggle: 1, climb: true, hide: true, huntable: false, cleaner: true, price: 18, count: 4, col: '#e8e0d0', moist: 1 }),
    P('waxworm', 'Waxworms', 'worm', { len: 12, nut: .5, val: 14, spd: 3.5, sense: 8, reflex: .05, struggle: 3.0, burrow: true, slow: true, price: 14, count: 3, col: '#efe6d0', segs: 10, fat: 1.25 }),
    P('darkling', 'Darkling Beetles', 'beetle', { len: 11, nut: .35, val: 14, spd: 10, sense: 18, reflex: .2, struggle: 4.0, climb: true, hide: true, price: 16, count: 2, col: '#141210', night: .6, danger: .2 }),
    P('gnat', 'Fungus Gnats', 'gnat', { len: 2.2, nut: .08, val: 3, spd: 12, sense: 14, reflex: .3, struggle: .8, fly: true, land: true, price: 8, count: 6, col: '#2a2420', moist: .6 }),
    P('pinhead', 'Pinhead Crickets', 'cricket', { len: 5, nut: .18, val: 7, spd: 16, sense: 22, reflex: .45, struggle: 1.6, hop: true, hide: true, price: 10, count: 4, col: '#8a6a40' }),
    P('beanbeetle', 'Bean Beetles', 'beetle', { len: 4, nut: .12, val: 5, spd: 8, sense: 14, reflex: .25, struggle: 1.5, fly: true, land: true, price: 10, count: 4, col: '#6a4a30', spots: true }),
    P('silkworm', 'Silkworms', 'worm', { len: 18, nut: .7, val: 20, spd: 2.5, sense: 6, reflex: .02, struggle: 4.0, slow: true, price: 22, count: 1, col: '#e8e4d8', segs: 12, fat: 1.4 }),
    P('lacewing', 'Lacewings', 'lacewing', { len: 10, nut: .25, val: 14, spd: 18, sense: 28, reflex: .45, struggle: 2.5, fly: true, land: true, price: 18, col: '#8ad07a', flowers: .8, night: .3 }),
    P('locust', 'Small Locusts', 'locust', { len: 18, nut: .7, val: 26, spd: 22, sense: 36, reflex: .55, struggle: 5.5, hop: true, fly: false, price: 28, col: '#8a8a3a', danger: .5 }),
  ];
  JT.PREY_BY_ID = {}; JT.PREY.forEach(p => JT.PREY_BY_ID[p.id] = p);
  JT.PREY_CAP = 40;

  // ---------------- Decor & plants ----------------
  // cat: decor | plants | ground. arche: geometry generator. p: params.
  // platform: can host stacked children. stack: may be stacked onto a platform.
  // cover: shelter strength. small: suitable for compact enclosures.
  const D = (id, name, cat, price, arche, p, f) => Object.assign({ id, name, cat, price, arche, p: p || {}, platform: false, stack: false, cover: 0, small: false }, f || {});
  JT.DECOR = [
    // --- Solid decor ---
    D('corkbark', 'Cork Bark', 'decor', 25, 'slab', { w: 46, d: 22, h: 9, style: 'cork' }, { platform: true, cover: .3, small: true }),
    D('corktower', 'Cork Tower', 'decor', 60, 'tower', { r: 13, h: 62, style: 'cork' }, { platform: true, cover: .2 }),
    D('driftwood', 'Driftwood', 'decor', 40, 'branch', { kind: 'drift', L: 80, h: 34, r: 3.2, col: '#9a8a74' }, { cover: .1 }),
    D('flatstone', 'Flat Stone', 'decor', 20, 'rock', { w: 38, d: 28, h: 6, style: 'rock' }, { platform: true, small: true }),
    D('slatestack', 'Slate Stack', 'decor', 45, 'rock', { w: 40, d: 30, h: 22, style: 'slate', layers: 4 }, { platform: true, cover: .2 }),
    D('bonsai', 'Mini Bonsai', 'plants', 70, 'tree', { kind: 'bonsai', h: 34, r: 2.6, spread: 30, leaf: '#4f7a2e', pot: true }, { stack: true, cover: .45 }),
    D('waterdish', 'Water Dish', 'decor', 15, 'dish', { r: 9, h: 4 }, { small: true, water: true }),
    D('corktube', 'Cork Tube', 'decor', 45, 'log', { L: 52, r: 9, style: 'cork', hollow: true }, { platform: false, cover: .7 }),
    D('corkround', 'Cork Round', 'decor', 35, 'tower', { r: 15, h: 16, style: 'cork' }, { platform: true, cover: .1, small: true }),
    D('corkslab', 'Cork Slab', 'decor', 40, 'rock', { w: 34, d: 12, h: 44, style: 'cork' }, { platform: false, cover: .35 }),
    D('corkledge', 'Cork Ledge', 'decor', 35, 'rock', { w: 36, d: 24, h: 30, style: 'cork', ledge: true }, { platform: true, cover: .25 }),
    D('tallspire', 'Tall Cork Spire', 'decor', 90, 'tower', { r: 10, h: 110, style: 'cork', taper: .7 }, { platform: true, cover: .2 }),
    D('mossstone', 'Moss Pole', 'decor', 45, 'tower', { r: 6, h: 80, style: 'moss' }, { platform: false, cover: .2 }),
    D('rockmesa', 'Rock Mesa', 'decor', 80, 'rock', { w: 62, d: 44, h: 32, style: 'sand', layers: 3 }, { platform: true, cover: .2 }),
    D('slatepillar', 'Slate Pillar', 'decor', 60, 'rock', { w: 22, d: 20, h: 58, style: 'slate', layers: 7 }, { platform: true, cover: .1 }),
    D('riverstone', 'River Stone', 'decor', 20, 'rock', { w: 26, d: 20, h: 10, style: 'river', round: true }, { platform: true, small: true }),
    D('sandshelf', 'Sandstone Shelf', 'decor', 50, 'rock', { w: 52, d: 30, h: 18, style: 'sand', layers: 3 }, { platform: true }),
    D('slateledge', 'Slate Ledge', 'decor', 40, 'rock', { w: 46, d: 26, h: 12, style: 'slate', layers: 2 }, { platform: true }),
    D('dewstone', 'Dew Stone', 'decor', 35, 'rock', { w: 24, d: 22, h: 12, style: 'river', round: true, dew: true }, { platform: true, small: true, water: true }),
    D('rockcave', 'Rock Cave', 'decor', 70, 'hide', { w: 42, d: 32, h: 22, style: 'rock' }, { platform: true, cover: .9 }),
    D('woodhide', 'Wood Hide', 'decor', 40, 'hide', { w: 30, d: 24, h: 16, style: 'wood' }, { platform: true, cover: .9, small: true }),
    D('coconut', 'Coconut Wood Hide', 'decor', 45, 'hide', { w: 28, d: 28, h: 18, style: 'coconut', dome: true }, { platform: false, cover: .9, small: true }),
    D('maghide', 'Magnetic Hide', 'decor', 40, 'hide', { w: 26, d: 14, h: 30, style: 'wood', wall: true }, { platform: true, cover: .8, small: true }),
    D('hollowlog', 'Hollow Log', 'decor', 60, 'log', { L: 70, r: 12, style: 'wood', hollow: true }, { cover: .8 }),
    D('feedledge', 'Feeding Ledge', 'decor', 30, 'rock', { w: 30, d: 20, h: 26, style: 'wood', ledge: true }, { platform: true, small: true }),
    D('minruin', 'Mini Ruin', 'decor', 90, 'ruin', { w: 60, d: 34, h: 34 }, { platform: true, cover: .4 }),
    D('flowerpot', 'Broken Flowerpot', 'decor', 35, 'log', { L: 30, r: 13, style: 'terracotta', hollow: true, half: true }, { cover: .8, small: true }),
    D('woodbridge', 'Tiny Wooden Bridge', 'decor', 45, 'branch', { kind: 'bridge', L: 70, h: 20, r: 2.5, col: '#8a6a44' }, {}),
    D('branchperch', 'Branch Perch', 'decor', 25, 'branch', { kind: 'perch', L: 60, h: 46, r: 2.4, col: '#6a4e34' }, { small: true }),
    D('forked', 'Forked Branch', 'decor', 35, 'branch', { kind: 'forked', L: 64, h: 56, r: 2.6, col: '#5e4630' }, {}),
    D('grapevine', 'Grapevine', 'decor', 40, 'branch', { kind: 'grape', L: 76, h: 50, r: 2.0, col: '#6a5040' }, {}),
    D('rootarch', 'Root Arch', 'decor', 45, 'branch', { kind: 'arch', L: 70, h: 34, r: 3.4, col: '#5a4030' }, { cover: .2 }),
    D('canopybranch', 'Canopy Branch', 'decor', 70, 'branch', { kind: 'canopy', L: 110, h: 80, r: 3, col: '#5a4432' }, {}),
    D('vinebridge', 'Twisted Vine Bridge', 'decor', 60, 'branch', { kind: 'vine', L: 100, h: 48, r: 1.8, col: '#6a5a3a', leaves: '#5a8a3a' }, {}),
    // --- Back walls (portrait towers) & wall-mounted pieces ---
    D('mosswall', 'Moss Back Wall', 'walls', 80, 'backwall', { w: 92, d: 10, h: 140, style: 'mosswall' }, { cover: .45, wall: true }),
    D('barkwall', 'Cork Bark Wall', 'walls', 80, 'backwall', { w: 92, d: 10, h: 140, style: 'barkwall' }, { cover: .45, wall: true }),
    D('stonewall', 'Fieldstone Wall', 'walls', 90, 'backwall', { w: 92, d: 10, h: 140, style: 'stonewall' }, { cover: .4, wall: true }),
    D('leafwall', 'Dead Leaf Wall', 'walls', 75, 'backwall', { w: 92, d: 10, h: 140, style: 'leafwall' }, { cover: .55, wall: true }),
    D('trunkwall', 'Tree Trunk Wall', 'walls', 95, 'backwall', { w: 92, d: 10, h: 140, style: 'trunkwall' }, { cover: .45, wall: true }),
    D('rootwall', 'Root Tangle Wall', 'walls', 90, 'backwall', { w: 92, d: 10, h: 140, style: 'rootwall' }, { cover: .6, wall: true }),
    D('sandwall', 'Sandstone Wall', 'walls', 85, 'backwall', { w: 92, d: 10, h: 140, style: 'sandwall' }, { cover: .35, wall: true }),
    D('driftwall', 'Driftwood Wall', 'walls', 85, 'backwall', { w: 92, d: 10, h: 140, style: 'driftwall' }, { cover: .4, wall: true }),
    D('wm_cork', 'Wall Cork Shelf', 'walls', 20, 'wallmount', { kind: 'shelf', w: 16, d: 9, th: 3.5, style: 'cork', moss: true }, { mount: true, small: true, cover: .15 }),
    D('wm_slate', 'Wall Slate Ledge', 'walls', 20, 'wallmount', { kind: 'shelf', w: 18, d: 8, th: 2.5, style: 'slate' }, { mount: true, small: true, cover: .1 }),
    D('wm_drift', 'Wall Driftwood Perch', 'walls', 22, 'wallmount', { kind: 'shelf', w: 20, d: 6.5, th: 3, style: 'drift' }, { mount: true, small: true, cover: .1 }),
    D('wm_fungi', 'Bracket Fungi Cluster', 'walls', 28, 'wallmount', { kind: 'fungi', w: 20 }, { mount: true, small: true, cover: .2 }),
    D('wm_pothos', 'Hanging Pothos Pocket', 'walls', 30, 'wallmount', { kind: 'planter', w: 16 }, { mount: true, small: true, cover: .5 }),
    D('wm_staghorn', 'Mounted Staghorn Fern', 'walls', 32, 'wallmount', { kind: 'staghorn', w: 18 }, { mount: true, small: true, cover: .45 }),
    D('beadvine', 'Cork Bead Vine', 'decor', 55, 'branch', { kind: 'beads', L: 84, h: 82, r: 1.4, col: '#6a4e34', leaves: '#5a8a3a' }, {}),
    D('mossmound', 'Moss Mound', 'decor', 25, 'rock', { w: 30, d: 24, h: 9, style: 'moss', round: true }, { platform: true, small: true, cover: .1 }),
    D('mangrove', 'Mangrove Root', 'decor', 85, 'branch', { kind: 'mangrove', L: 70, h: 70, r: 3.2, col: '#4a3a2c' }, { cover: .2 }),
    // --- Trees & plants ---
    D('tinytree', 'Tiny Tree', 'plants', 60, 'tree', { kind: 'tiny', h: 60, r: 2.8, spread: 38, leaf: '#5a8a34' }, { stack: true, cover: .5 }),
    D('grandtree', 'Grand Habitat Tree', 'plants', 180, 'tree', { kind: 'grand', h: 130, r: 5.2, spread: 80, leaf: '#4a7a2a' }, { cover: .6 }),
    D('ficus', 'Mini Ficus', 'plants', 70, 'tree', { kind: 'ficus', h: 52, r: 2.2, spread: 34, leaf: '#3e7a34' }, { stack: true, cover: .55 }),
    D('fern', 'Fern', 'plants', 25, 'fern', { n: 7, L: 34, h: 26, leaf: '#4f8a34' }, { stack: true, cover: .6, small: true }),
    D('maidenhair', 'Maidenhair Fern', 'plants', 35, 'fern', { n: 9, L: 26, h: 22, leaf: '#7ab04a', fine: true }, { stack: true, cover: .55, small: true }),
    D('palmetto', 'Dwarf Palmetto', 'plants', 45, 'palm', { n: 6, L: 32, h: 40, leaf: '#4a7a3a', fan: true }, { stack: true, cover: .5 }),
    D('minipalm', 'Mini Palm', 'plants', 50, 'palm', { n: 7, L: 30, h: 48, leaf: '#5a8a3a', trunk: 22 }, { stack: true, cover: .45 }),
    D('spiderplant', 'Spider Plant', 'plants', 30, 'grass', { n: 14, L: 30, h: 18, leaf: '#8ac060', stripe: '#e8f0c0', arch: 1 }, { stack: true, cover: .5, small: true }),
    D('tallgrass', 'Tall Grass', 'plants', 20, 'grass', { n: 16, L: 18, h: 48, leaf: '#7aa040' }, { stack: true, cover: .55, small: true }),
    D('airplant', 'Air Plant', 'plants', 20, 'rosette', { n: 10, L: 10, h: 6, leaf: '#9ab89a', thin: true }, { stack: true, small: true }),
    D('monstera', 'Mini Monstera', 'plants', 55, 'broadleaf', { n: 5, h: 36, leafL: 22, leafW: 18, leaf: '#2f6a2a', split: true }, { stack: true, cover: .75 }),
    D('calathea', 'Calathea', 'plants', 45, 'broadleaf', { n: 6, h: 34, leafL: 18, leafW: 9, leaf: '#3a6a3a', leaf2: '#8a3a5a', upright: true, stripe: true }, { stack: true, cover: .6 }),
    D('pothos', 'Pothos', 'plants', 35, 'broadleaf', { n: 7, h: 20, leafL: 11, leafW: 8, leaf: '#4a8a2a', trailing: true, heart: true, variegate: '#e0e080' }, { stack: true, cover: .55, small: true }),
    D('broadshelter', 'Broad Leaf Shelter', 'plants', 50, 'broadleaf', { n: 3, h: 24, leafL: 30, leafW: 20, leaf: '#3a7a30', roof: true }, { stack: true, cover: .9 }),
    D('fittonia', 'Fittonia', 'plants', 25, 'broadleaf', { n: 9, h: 10, leafL: 7, leafW: 5, leaf: '#3a6a3a', vein: '#f0b0c0' }, { stack: true, cover: .4, small: true }),
    D('dewcup', 'Dew Cup Plant', 'plants', 40, 'rosette', { n: 7, L: 16, h: 12, leaf: '#4a8a4a', cup: true }, { stack: true, cover: .4, small: true, water: true }),
    D('bromeliad', 'Bromeliad', 'plants', 40, 'rosette', { n: 9, L: 20, h: 14, leaf: '#4a7a3a', tip: '#c04a5a', cup: true }, { stack: true, cover: .45, water: true }),
    D('redbromeliad', 'Red Bromeliad', 'plants', 55, 'rosette', { n: 10, L: 22, h: 16, leaf: '#8a2a2a', tip: '#e04a3a', cup: true }, { stack: true, cover: .45, water: true }),
    D('succulent', 'Succulent', 'plants', 20, 'rosette', { n: 12, L: 9, h: 5, leaf: '#7ab0a0', fat: true }, { stack: true, small: true }),
    D('mossrosette', 'Moss Rosette', 'plants', 15, 'rosette', { n: 14, L: 5, h: 3, leaf: '#6a9a3a', fat: true }, { stack: true, small: true }),
    D('toadstools', 'Toadstools', 'plants', 35, 'mushroom', { n: 4, h: 24, cap: 6, col: '#cf4a24', spots: true, stem: '#f0e6d0' }, { stack: true, small: true, cover: .15 }),
    D('echeveria', 'Echeveria', 'plants', 30, 'rosette', { n: 16, L: 12, h: 8, leaf: '#d99280', tip: '#b04a58', fat: true }, { stack: true, small: true, cover: .2 }),
    D('glowshroom', 'Glow Mushrooms', 'plants', 40, 'mushroom', { n: 5, h: 14, cap: 5, col: '#e8f0d0', glow: '#b0ffd0' }, { stack: true, small: true }),
    D('climbvine', 'Climbing Vine', 'plants', 35, 'vine', { h: 70, leaf: '#4a8a3a' }, { stack: true, cover: .35 }),
    D('creepfig', 'Creeping Fig', 'plants', 30, 'vine', { h: 40, leaf: '#3a7a2a', creep: true, small: true }, { stack: true, cover: .35, small: true }),
    D('ivy', 'Creeping Ivy', 'plants', 30, 'vine', { h: 50, leaf: '#2f5e2a', ivy: true }, { stack: true, cover: .35 }),
    D('pinkflowers', 'Pink Flowers', 'plants', 30, 'flower', { n: 7, h: 30, petal: '#f08ab0', center: '#f8e070', cluster: true }, { stack: true, cover: .3, flowers: true, small: true }),
    D('daisies', 'Daisies', 'plants', 25, 'flower', { n: 6, h: 26, petal: '#fafaf0', center: '#f0c030', daisy: true }, { stack: true, cover: .25, flowers: true, small: true }),
    D('lavender', 'Lavender', 'plants', 30, 'flower', { n: 9, h: 36, petal: '#9a7ad0', center: '#7a5ab0', spike: true }, { stack: true, cover: .3, flowers: true }),
    D('wildflowers', 'Red Wildflowers', 'plants', 30, 'flower', { n: 6, h: 32, petal: '#d8302a', center: '#2a1a10', poppy: true }, { stack: true, cover: .25, flowers: true }),
    D('orchid', 'Jungle Orchid', 'plants', 70, 'flower', { n: 3, h: 40, petal: '#f0e0f8', center: '#c03a8a', orchid: true, leaves: true }, { stack: true, cover: .3, flowers: true }),
    D('miniorchid', 'Mini Orchid', 'plants', 45, 'flower', { n: 2, h: 26, petal: '#f8b0d0', center: '#d04a7a', orchid: true, leaves: true }, { stack: true, cover: .25, flowers: true, small: true }),
    D('driedflowers', 'Dried Flowers', 'plants', 20, 'flower', { n: 6, h: 30, petal: '#c09a6a', center: '#8a6a4a', dried: true }, { stack: true, cover: .2, flowers: false, small: true }),
    // --- Ground cover (non-navigable, provides cover & moisture) ---
    D('mosspatch', 'Moss Patch', 'ground', 10, 'scatter', { kind: 'moss', r: 22, col: '#5a8a2e' }, { cover: .3, small: true, moist: .6 }),
    D('leaflitter', 'Leaf Litter', 'ground', 10, 'scatter', { kind: 'leaves', r: 24, col: '#8a5a2a', n: 22 }, { cover: .6, small: true, moist: .4 }),
    D('oaklitter', 'Oak Leaf Litter', 'ground', 12, 'scatter', { kind: 'oak', r: 26, col: '#9a6a30', n: 18 }, { cover: .6, small: true, moist: .4 }),
    D('magnolia', 'Magnolia Leaves', 'ground', 14, 'scatter', { kind: 'magnolia', r: 28, col: '#7a5030', n: 9 }, { cover: .65, moist: .4 }),
    D('pebbles', 'Pebbles', 'ground', 10, 'scatter', { kind: 'pebbles', r: 18, col: '#9a948a', n: 16 }, { cover: .1, small: true }),
    D('seedpods', 'Seed Pods', 'ground', 12, 'scatter', { kind: 'pods', r: 16, col: '#6a4a2a', n: 7 }, { cover: .2, small: true }),
    D('pinecones', 'Pinecones', 'ground', 14, 'scatter', { kind: 'cones', r: 20, col: '#7a5230', n: 4 }, { cover: .3 }),
    D('barkchips', 'Bark Chips', 'ground', 10, 'scatter', { kind: 'chips', r: 22, col: '#6a4428', n: 14 }, { cover: .35, small: true, moist: .2 }),
    D('lichen', 'Lichen Patch', 'ground', 12, 'scatter', { kind: 'lichen', r: 16, col: '#b8c8a0' }, { cover: .1, small: true }),
    D('twigs', 'Twig Scatter', 'ground', 10, 'scatter', { kind: 'twigs', r: 22, col: '#6a5038', n: 9 }, { cover: .25, small: true }),
    D('cushionmoss', 'Cushion Moss', 'ground', 12, 'scatter', { kind: 'moss', r: 24, col: '#7aa83a' }, { cover: .3, small: true, moist: .7 }),
    D('clover', 'Clover Patch', 'ground', 12, 'scatter', { kind: 'clover', r: 18, col: '#4a8a3a' }, { cover: .4, small: true, moist: .4 }),
  ];
  JT.DECOR_BY_ID = {}; JT.DECOR.forEach(d => JT.DECOR_BY_ID[d.id] = d);

  // ---------------- Field journal ----------------
  JT.JOURNAL = [
    { id: 'firstHunt', title: 'First Successful Hunt', icon: '🎯', text: 'A jumper stalked, pounced and secured its first meal in your habitat.' },
    { id: 'ambushHigh', title: 'Ambush from Above', icon: '🦅', text: 'A jumper used an elevated perch to strike prey below.' },
    { id: 'ambushCover', title: 'Ambush from Cover', icon: '🌿', text: 'A jumper approached unseen from behind cover or from the rear.' },
    { id: 'stepping', title: 'Stepping Stones', icon: '🪨', text: 'A jumper chained several habitat surfaces together to reach prey.' },
    { id: 'safeMeal', title: 'A Safe Place to Eat', icon: '🍃', text: 'A jumper carried its catch to a sheltered perch before feeding.' },
    { id: 'drink', title: 'Sipping a Droplet', icon: '💧', text: 'A thirsty jumper sought out a mist droplet and drank.' },
    { id: 'molt', title: 'Successful Molt', icon: '🦋', text: 'A jumper shed its old exoskeleton and grew a stage.' },
    { id: 'retreat', title: 'Silk Retreat', icon: '🕸️', text: 'A jumper wove a silk retreat to sleep or molt inside.' },
    { id: 'safety', title: 'Safety Silk', icon: '🧵', text: 'A jumper anchored a dragline before leaping.' },
    { id: 'investigate', title: 'Curious Inspection', icon: '🔍', text: 'A jumper went to investigate something newly placed in its habitat.' },
    { id: 'territorial', title: 'Territorial Display', icon: '⚔️', text: 'Two jumpers faced off with raised legs and posturing.' },
    { id: 'cannibal', title: 'Cannibalism', icon: '🕷️', text: 'A jumper hunted another jumper. Nature is not always cozy.' },
    { id: 'tinyEscape', title: 'Tiny Jumper Escape', icon: '💨', text: 'A tiny jumper sensed danger and leapt away just in time.' },
    { id: 'tinyCatch', title: 'Jumper vs Jumper', icon: '🕸', text: 'A jumper caught a tiny live-food jumper.' },
    { id: 'softMolt', title: 'Fresh-molt Vulnerability', icon: '🫧', text: 'A freshly molted jumper rested pale and soft while its new skin hardened.' },
    { id: 'adult', title: 'Reaching Adulthood', icon: '⭐', text: 'A jumper completed its final molt into an adult.' },
    { id: 'veteran', title: 'Seasoned Adult', icon: '🏅', text: 'A jumper has lived a long, full adult life in your care.' },
    { id: 'display', title: 'Courtship Dance', icon: '💃', text: 'A display-oriented jumper performed its leg-waving dance.' },
    { id: 'intercept', title: 'Reading the Prey', icon: '🧠', text: 'A jumper predicted where moving prey was heading and intercepted it.' },
    { id: 'cleanup', title: 'Cleanup Crew', icon: '🧹', text: 'Springtails or isopods found and cleaned up feeder remains.' },
  ];

  // ---------------- Presets ----------------
  // Themes: weighted pools. Generated adaptively for any enclosure shape.
  JT.PRESET_THEMES = {
    cork:     { sub: 'coco',   bg: 'hollow',  tall: ['corktower', 'tallspire'], mid: ['corkbark', 'corkround', 'corkledge', 'driftwood'], plants: ['fern', 'pothos', 'creepfig', 'tallgrass'], ground: ['leaflitter', 'mosspatch', 'barkchips'] },
    flower:   { sub: 'forest', bg: 'meadow',  tall: ['tinytree'], mid: ['flatstone', 'branchperch'], plants: ['pinkflowers', 'daisies', 'lavender', 'wildflowers', 'tallgrass'], ground: ['clover', 'mosspatch'] },
    forest:   { sub: 'forest', bg: 'mossy',   tall: ['tinytree', 'forked'], mid: ['hollowlog', 'driftwood', 'riverstone'], plants: ['fern', 'maidenhair', 'glowshroom'], ground: ['oaklitter', 'mosspatch', 'pinecones', 'twigs'] },
    paradise: { sub: 'jungle', bg: 'canopy',  tall: ['grandtree', 'corktower'], mid: ['rockmesa', 'canopybranch', 'corkbark'], plants: ['monstera', 'bromeliad', 'fern', 'orchid', 'pinkflowers'], ground: ['leaflitter', 'mosspatch'] },
    ruin:     { sub: 'moss',   bg: 'stone',   tall: ['slatepillar'], mid: ['minruin', 'flowerpot', 'slatestack'], plants: ['ivy', 'fern', 'creepfig', 'glowshroom'], ground: ['mosspatch', 'lichen'] },
    canopy:   { sub: 'jungle', bg: 'canopy',  tall: ['grandtree', 'tallspire', 'canopybranch'], mid: ['forked', 'corkledge'], plants: ['bromeliad', 'monstera', 'climbvine', 'orchid'], ground: ['leaflitter'] },
    vertical: { sub: 'coco',   bg: 'hollow',  tall: ['tallspire', 'mossstone', 'forked'], mid: ['corkledge', 'branchperch'], plants: ['climbvine', 'pothos', 'airplant', 'redbromeliad'], ground: ['mosspatch'] },
    dry:      { sub: 'desert', bg: 'twilight',tall: ['forked'], mid: ['rockmesa', 'sandshelf', 'driftwood', 'rockcave'], plants: ['succulent', 'driedflowers', 'tallgrass', 'airplant'], ground: ['pebbles', 'twigs'] },
    canyon:   { sub: 'clay',   bg: 'twilight',tall: ['slatepillar'], mid: ['rockmesa', 'slatestack', 'slateledge', 'rockcave'], plants: ['succulent', 'tallgrass', 'driedflowers'], ground: ['pebbles', 'lichen'] },
    meadow:   { sub: 'forest', bg: 'meadow',  tall: ['branchperch'], mid: ['flatstone', 'riverstone', 'woodbridge'], plants: ['tallgrass', 'daisies', 'wildflowers', 'lavender', 'spiderplant'], ground: ['clover', 'mosspatch'] },
    nursery:  { sub: 'coco',   bg: 'mossy',   tall: ['branchperch'], mid: ['corkround', 'woodhide'], plants: ['fittonia', 'mossrosette', 'pothos'], ground: ['mosspatch', 'leaflitter'] },
    minimal:  { sub: 'coco',   bg: 'stone',   tall: ['branchperch'], mid: ['maghide', 'corkround'], plants: ['pothos'], ground: ['mosspatch'] },
    jungle:   { sub: 'jungle', bg: 'canopy',  tall: ['ficus', 'mangrove'], mid: ['corkbark', 'rootarch', 'vinebridge'], plants: ['monstera', 'calathea', 'fern', 'bromeliad', 'pothos'], ground: ['leaflitter', 'magnolia'] },
    mushroom: { sub: 'black',  bg: 'log',     tall: ['tinytree'], mid: ['hollowlog', 'corkbark', 'riverstone'], plants: ['glowshroom', 'fern', 'maidenhair', 'glowshroom'], ground: ['mosspatch', 'oaklitter'] },
    rock:     { sub: 'gravel', bg: 'stone',   tall: ['slatepillar'], mid: ['slatestack', 'slateledge', 'riverstone', 'dewstone'], plants: ['fern', 'succulent', 'mossrosette'], ground: ['pebbles', 'lichen'] },
    mosswall: { sub: 'moss',   bg: 'mossy',   tall: ['mosswall', 'mossstone'], mid: ['beadvine', 'mossmound', 'wm_fungi', 'wm_cork', 'maghide'], plants: ['toadstools', 'fern', 'echeveria', 'maidenhair', 'toadstools', 'glowshroom'], ground: ['cushionmoss', 'mosspatch'], back: true },
    barkwall: { sub: 'coco',   bg: 'hollow',  tall: ['barkwall', 'corktower'], mid: ['wm_cork', 'wm_staghorn', 'wm_cork', 'branchperch', 'corkround'], plants: ['fern', 'pothos', 'bromeliad', 'fittonia', 'mossrosette'], ground: ['leaflitter', 'mosspatch'], back: true },
    stonewall: { sub: 'gravel', bg: 'stone',  tall: ['stonewall', 'slatepillar'], mid: ['wm_slate', 'wm_pothos', 'wm_slate', 'riverstone', 'dewstone'], plants: ['ivy', 'fern', 'mossrosette', 'maidenhair'], ground: ['lichen', 'mosspatch', 'pebbles'], back: true },
    leafwall: { sub: 'forest',  bg: 'log',    tall: ['leafwall', 'forked'], mid: ['wm_fungi', 'wm_cork', 'hollowlog', 'branchperch'], plants: ['toadstools', 'fern', 'glowshroom', 'maidenhair'], ground: ['oaklitter', 'leaflitter', 'twigs'], back: true },
    trunkwall: { sub: 'forest', bg: 'mossy',  tall: ['trunkwall', 'tinytree'], mid: ['wm_fungi', 'wm_staghorn', 'wm_fungi', 'rootarch', 'mossmound'], plants: ['fern', 'toadstools', 'ivy', 'glowshroom'], ground: ['mosspatch', 'oaklitter', 'pinecones'], back: true },
    rootwall: { sub: 'jungle',  bg: 'canopy', tall: ['rootwall', 'mangrove'], mid: ['wm_pothos', 'wm_cork', 'vinebridge', 'rootarch'], plants: ['monstera', 'calathea', 'fern', 'pothos', 'bromeliad'], ground: ['leaflitter', 'magnolia'], back: true },
    sandwall: { sub: 'desert',  bg: 'twilight', tall: ['sandwall', 'forked'], mid: ['wm_drift', 'wm_slate', 'sandshelf', 'rockcave'], plants: ['succulent', 'echeveria', 'driedflowers', 'airplant'], ground: ['pebbles', 'twigs'], back: true },
    driftwall: { sub: 'clay',   bg: 'twilight', tall: ['driftwall', 'driftwood'], mid: ['wm_drift', 'wm_staghorn', 'wm_drift', 'flatstone'], plants: ['airplant', 'succulent', 'tallgrass', 'redbromeliad'], ground: ['pebbles', 'lichen'], back: true },
    feeding:  { sub: 'coco',   bg: 'mossy',   tall: ['branchperch'], mid: ['feedledge', 'corkbark'], plants: ['pothos', 'fern'], ground: ['mosspatch'] },
  };
  // preset name -> [theme, habitat types]
  JT.PRESETS = [
    ['Cork Forest', 'cork', ['standard', 'wide', 'cube']], ['Flower Garden', 'flower', ['standard', 'wide', 'panoramic']], ['Old Forest Floor', 'forest', ['standard', 'wide']],
    ['Spider Paradise', 'paradise', ['standard', 'cube', 'panoramic']], ['Overgrown Ruin', 'ruin', ['standard', 'panoramic']],
    ['Canopy Tower', 'canopy', ['arboreal', 'cube']], ['Vertical Hunter', 'vertical', ['arboreal']], ['Bromeliad Wall', 'vertical', ['arboreal']], ['Vine Column', 'vertical', ['arboreal', 'jar']], ['Rainforest Canopy', 'canopy', ['arboreal', 'cube']],
    ['Dry Woodland', 'dry', ['wide', 'standard']], ['Rocky Canyon', 'canyon', ['wide', 'panoramic']], ['Meadow Run', 'meadow', ['wide']], ['Long Hunt Lane', 'meadow', ['wide', 'panoramic']], ['Flower Verge', 'flower', ['wide']],
    ['Sling Nursery', 'nursery', ['nano', 'breeder']], ['Minimal Breeder', 'minimal', ['nano', 'breeder']], ['Moss Cup', 'nursery', ['nano']], ['Tiny Jungle', 'jungle', ['nano', 'breeder']],
    ['Deep Jungle', 'jungle', ['cube', 'standard']], ['Root Cathedral', 'jungle', ['cube']], ['Layered Rock', 'rock', ['cube', 'standard']], ['Mushroom Grove', 'mushroom', ['cube', 'standard']], ['Cube Paradise', 'paradise', ['cube']],
    ['Clean Breeder', 'minimal', ['breeder']], ['Cork Strip', 'cork', ['breeder', 'nano']], ['Feeding Ledge Setup', 'feeding', ['breeder', 'nano']], ['Dry Minimal', 'dry', ['breeder', 'nano']],
    ['Woodland Panorama', 'forest', ['panoramic']], ['Garden Walk', 'flower', ['panoramic']], ['Canyon Run', 'canyon', ['panoramic']], ['Showcase Jungle', 'jungle', ['panoramic']], ['Panoramic Ruin', 'ruin', ['panoramic']],
    ['Moss Tower', 'mosswall', ['tower', 'arboreal', 'cube']], ['Mushroom Wall', 'mosswall', ['tower', 'standard']], ['Cork Bark Tower', 'barkwall', ['tower', 'arboreal']], ['Stone Garden Wall', 'stonewall', ['tower', 'cube']], ['Autumn Leaf Wall', 'leafwall', ['tower', 'standard']], ['Old Oak Trunk', 'trunkwall', ['tower', 'arboreal']], ['Root Cellar', 'rootwall', ['tower', 'cube']], ['Sandstone Cliff', 'sandwall', ['tower', 'wide']], ['Driftwood Shore', 'driftwall', ['tower', 'standard']], ['Tower Canopy', 'vertical', ['tower']], ['Tower Jungle', 'jungle', ['tower']],
        ['Jar Jungle', 'jungle', ['jar']], ['Moss Lantern', 'mushroom', ['jar']], ['Vine Spiral', 'vertical', ['jar']], ['Flower Jar', 'flower', ['jar']], ['Vertical Cork Jar', 'cork', ['jar']],
  ];
})(typeof window !== 'undefined' ? window : globalThis);
