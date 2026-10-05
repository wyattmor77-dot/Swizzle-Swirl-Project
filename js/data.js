/* =========================================================
   AI FOOD FACTORY — GAME DATA
   Foods, ingredients, printer cartridges and customers.
   To add a new food: add its ingredients to INGREDIENTS,
   then add an entry to FOODS (groups + printing order).
   ========================================================= */

// Printer cartridges. Every ingredient is printed from one of these.
const CARTRIDGES = {
  bread:   { label: 'GRAIN',   color: '#f2b25c' },
  protein: { label: 'PROTEIN', color: '#d0583a' },
  dairy:   { label: 'DAIRY',   color: '#ffd84a' },
  veg:     { label: 'PRODUCE', color: '#4fd06a' },
  sauce:   { label: 'SAUCE',   color: '#ff4d6d' },
  sweet:   { label: 'SWEET',   color: '#ff8fd8' },
};
const CARTRIDGE_ORDER = ['bread', 'protein', 'dairy', 'veg', 'sauce', 'sweet'];

// name, cartridge, shape (see renderer.js), colour + optional shape params
const INGREDIENTS = {
  // --- buns & breads ---
  bunBottom:     { name: 'Bottom Bun', cart: 'bread', shape: 'bunBottom', color: '#e0a052' },
  bunTop:        { name: 'Sesame Top Bun', cart: 'bread', shape: 'bunTop', color: '#e39a45', seeds: true },
  briocheBottom: { name: 'Brioche Bottom Bun', cart: 'bread', shape: 'bunBottom', color: '#d4832f' },
  briocheTop:    { name: 'Brioche Top Bun', cart: 'bread', shape: 'bunTop', color: '#c9772a', seeds: false },
  whiteBread:    { name: 'White Bread', cart: 'bread', shape: 'bread', color: '#f6e2b8', crust: '#c98d4b' },
  wheatBread:    { name: 'Wheat Bread', cart: 'bread', shape: 'bread', color: '#c99a62', crust: '#7f5228' },
  ryeBread:      { name: 'Rye Bread', cart: 'bread', shape: 'bread', color: '#a9794c', crust: '#55361b' },
  // --- proteins ---
  beefPatty:     { name: 'Beef Patty', cart: 'protein', shape: 'patty', color: '#6b3a22' },
  chickenPatty:  { name: 'Chicken Patty', cart: 'protein', shape: 'crispy', color: '#d99a3e' },
  veggiePatty:   { name: 'Veggie Patty', cart: 'protein', shape: 'patty', color: '#6f8f3b' },
  crispyChicken: { name: 'Crispy Chicken', cart: 'protein', shape: 'crispy', color: '#dc9d3f' },
  spicyChicken:  { name: 'Spicy Crispy Chicken', cart: 'protein', shape: 'crispy', color: '#d4622a' },
  grilledChicken:{ name: 'Grilled Chicken', cart: 'protein', shape: 'grilled', color: '#c08445' },
  turkey:        { name: 'Turkey', cart: 'protein', shape: 'deli', color: '#f2cdb0' },
  ham:           { name: 'Ham', cart: 'protein', shape: 'deli', color: '#f29ca8' },
  // --- cheeses ---
  cheddar:       { name: 'Cheddar Cheese', cart: 'dairy', shape: 'cheeseSlice', color: '#ffad2a' },
  american:      { name: 'American Cheese', cart: 'dairy', shape: 'cheeseSlice', color: '#ffd23f' },
  pepperJack:    { name: 'Pepper Jack', cart: 'dairy', shape: 'cheeseSlice', color: '#f6e7a8', specks: true },
  swiss:         { name: 'Swiss Cheese', cart: 'dairy', shape: 'cheeseSlice', color: '#fff1a6', holes: true },
  // --- produce ---
  lettuce:       { name: 'Lettuce', cart: 'veg', shape: 'lettuce', color: '#6cc644' },
  tomato:        { name: 'Tomato', cart: 'veg', shape: 'slices', color: '#e8443a', inner: '#ff7a5c' },
  cucumber:      { name: 'Cucumber', cart: 'veg', shape: 'slices', color: '#3f8f3a', inner: '#cfeeb0' },
  pickles:       { name: 'Pickles', cart: 'veg', shape: 'pickles', color: '#7aa83a' },
  onion:         { name: 'Onion', cart: 'veg', shape: 'onion', color: '#c99ad8' },
  // --- sauces ---
  ketchup:       { name: 'Ketchup', cart: 'sauce', shape: 'sauce', color: '#d6281e' },
  mustard:       { name: 'Mustard', cart: 'sauce', shape: 'sauce', color: '#f2c200' },
  specialSauce:  { name: 'Special Sauce', cart: 'sauce', shape: 'sauce', color: '#f2925f' },
  mayo:          { name: 'Mayo', cart: 'sauce', shape: 'sauce', color: '#fff4d6' },
  spicyMayo:     { name: 'Spicy Mayo', cart: 'sauce', shape: 'sauce', color: '#ff8c5a' },
  honeyMustard:  { name: 'Honey Mustard', cart: 'sauce', shape: 'sauce', color: '#e9b23a' },
  // --- pizza ---
  dough:         { name: 'Pizza Dough', cart: 'bread', shape: 'pizzaDough', color: '#f0c987' },
  tomatoSauce:   { name: 'Tomato Sauce', cart: 'sauce', shape: 'pizzaSauce', color: '#c9302c' },
  bbqSauce:      { name: 'BBQ Sauce', cart: 'sauce', shape: 'pizzaSauce', color: '#7a2e14' },
  pesto:         { name: 'Pesto', cart: 'sauce', shape: 'pizzaSauce', color: '#5c8f2b' },
  mozzarella:    { name: 'Mozzarella', cart: 'dairy', shape: 'pizzaCheese', color: '#fff0b0' },
  pepperoni:     { name: 'Pepperoni', cart: 'protein', shape: 'scatter', item: 'pepperoni', color: '#b8261c' },
  mushrooms:     { name: 'Mushrooms', cart: 'veg', shape: 'scatter', item: 'mushroom', color: '#d8c3a5' },
  peppers:       { name: 'Green Peppers', cart: 'veg', shape: 'scatter', item: 'pepper', color: '#2fae49' },
  olives:        { name: 'Black Olives', cart: 'veg', shape: 'scatter', item: 'olive', color: '#262626' },
  pineapple:     { name: 'Pineapple', cart: 'sweet', shape: 'scatter', item: 'pineapple', color: '#ffd84a' },
  basil:         { name: 'Fresh Basil', cart: 'veg', shape: 'scatter', item: 'leaf', color: '#2f8f3a' },
  oregano:       { name: 'Oregano', cart: 'veg', shape: 'scatter', item: 'flake', color: '#557a1f' },
  // --- tacos ---
  hardShell:     { name: 'Hard Corn Shell', cart: 'bread', shape: 'tacoShell', color: '#f2bf4b' },
  softShell:     { name: 'Soft Flour Tortilla', cart: 'bread', shape: 'tacoShell', color: '#f3dfb4', spots: true },
  tacoBeef:      { name: 'Seasoned Beef', cart: 'protein', shape: 'tacoFill', item: 'meat', color: '#7a3f1d' },
  tacoChicken:   { name: 'Shredded Chicken', cart: 'protein', shape: 'tacoFill', item: 'meat', color: '#d9a865' },
  beans:         { name: 'Black Beans', cart: 'protein', shape: 'tacoFill', item: 'beans', color: '#3b2a2a' },
  tacoCheese:    { name: 'Shredded Cheese', cart: 'dairy', shape: 'tacoFill', item: 'shred', color: '#ffad2a' },
  tacoLettuce:   { name: 'Shredded Lettuce', cart: 'veg', shape: 'tacoFill', item: 'shred', color: '#6cc644' },
  tacoTomato:    { name: 'Diced Tomato', cart: 'veg', shape: 'tacoFill', item: 'cube', color: '#e8443a' },
  tacoOnion:     { name: 'Diced Onion', cart: 'veg', shape: 'tacoFill', item: 'cube', color: '#efe3f5' },
  sourCream:     { name: 'Sour Cream', cart: 'dairy', shape: 'tacoFill', item: 'dollop', color: '#fffaf0' },
  guac:          { name: 'Guacamole', cart: 'veg', shape: 'tacoFill', item: 'dollop', color: '#8bc34a' },
  salsa:         { name: 'Hot Salsa', cart: 'sauce', shape: 'tacoFill', item: 'dollop', color: '#e0301e' },
  // --- hot dog ---
  hotdogBun:     { name: 'Hot Dog Bun', cart: 'bread', shape: 'hotdogBun', color: '#e3a557' },
  beefFrank:     { name: 'Beef Frank', cart: 'protein', shape: 'sausage', color: '#b5442c' },
  chickenFrank:  { name: 'Chicken Frank', cart: 'protein', shape: 'sausage', color: '#d9825b' },
  veggieDog:     { name: 'Veggie Dog', cart: 'protein', shape: 'sausage', color: '#8a6a3a' },
  hdOnion:       { name: 'Diced Onion', cart: 'veg', shape: 'hdDots', color: '#f3eefa' },
  relish:        { name: 'Relish', cart: 'veg', shape: 'hdDots', color: '#5bb33b' },
  jalapenos:     { name: 'Jalapeños', cart: 'veg', shape: 'hdDots', color: '#2f8a2a', big: true },
  hdKetchup:     { name: 'Ketchup', cart: 'sauce', shape: 'zigzag', color: '#d6281e' },
  hdMustard:     { name: 'Mustard', cart: 'sauce', shape: 'zigzag', color: '#f2c200', phase: 1 },
  // --- fries & nuggets ---
  friesBox:      { name: 'Fry Carton', cart: 'bread', shape: 'friesBox', color: '#e3262f' },
  friesReg:      { name: 'Regular Fries', cart: 'bread', shape: 'fries', color: '#ffd257', count: 15, len: 0 },
  friesLarge:    { name: 'Large Fries', cart: 'bread', shape: 'fries', color: '#ffd257', count: 24, len: 28 },
  salt:          { name: 'Sea Salt', cart: 'sauce', shape: 'sprinkle', color: '#ffffff' },
  cajun:         { name: 'Cajun Spice', cart: 'sauce', shape: 'sprinkle', color: '#c8501a' },
  dipKetchup:    { name: 'Ketchup Dip', cart: 'sauce', shape: 'dipCup', color: '#d6281e' },
  dipCheese:     { name: 'Cheese Sauce Dip', cart: 'dairy', shape: 'dipCup', color: '#ffad2a' },
  dipBbq:        { name: 'BBQ Dip', cart: 'sauce', shape: 'dipCup', color: '#6e2a14' },
  dipHoney:      { name: 'Honey Mustard Dip', cart: 'sauce', shape: 'dipCup', color: '#e9b23a' },
  nugTray:       { name: 'Nugget Tray', cart: 'bread', shape: 'nugTray', color: '#38a6e8' },
  nug6:          { name: '6 Chicken Nuggets', cart: 'protein', shape: 'nuggets', color: '#dc9d3f', count: 6 },
  nug10:         { name: '10 Chicken Nuggets', cart: 'protein', shape: 'nuggets', color: '#dc9d3f', count: 10 },
  // --- donut ---
  donutClassic:  { name: 'Classic Donut Ring', cart: 'bread', shape: 'donutRing', color: '#e0a35a' },
  donutChoc:     { name: 'Chocolate Donut Ring', cart: 'bread', shape: 'donutRing', color: '#7a4a2a' },
  glazeStraw:    { name: 'Strawberry Glaze', cart: 'sweet', shape: 'glaze', color: '#ff8fbf' },
  glazeChoc:     { name: 'Chocolate Glaze', cart: 'sweet', shape: 'glaze', color: '#5a3320' },
  glazeVanilla:  { name: 'Vanilla Glaze', cart: 'sweet', shape: 'glaze', color: '#fff4e0' },
  donutSprinkles:{ name: 'Rainbow Sprinkles', cart: 'sweet', shape: 'donutSprinkles' },
  chocChips:     { name: 'Chocolate Chips', cart: 'sweet', shape: 'donutSprinkles', chips: true },
  // --- ice cream ---
  waffleCone:    { name: 'Waffle Cone', cart: 'bread', shape: 'cone', color: '#d99a4e' },
  iceCup:        { name: 'Cup', cart: 'bread', shape: 'iceCup', color: '#4fc3f7' },
  vanilla:       { name: 'Vanilla Scoop', cart: 'dairy', shape: 'scoop', color: '#fff3d6' },
  chocolate:     { name: 'Chocolate Scoop', cart: 'dairy', shape: 'scoop', color: '#7a4a2e' },
  strawberry:    { name: 'Strawberry Scoop', cart: 'dairy', shape: 'scoop', color: '#ffb3c7' },
  mint:          { name: 'Mint Chip Scoop', cart: 'dairy', shape: 'scoop', color: '#a8f0d0', chips: true },
  icSyrup:       { name: 'Chocolate Syrup', cart: 'sweet', shape: 'scoopSyrup', color: '#4a2511' },
  whipped:       { name: 'Whipped Cream', cart: 'dairy', shape: 'whipped', color: '#ffffff' },
  icSprinkles:   { name: 'Rainbow Sprinkles', cart: 'sweet', shape: 'scoopSprinkles' },
  cherry:        { name: 'Cherry', cart: 'sweet', shape: 'cherry', color: '#d0102a' },
  // --- pancakes ---
  plate:         { name: 'Printed Plate', cart: 'bread', shape: 'plate', color: '#f4f7fb' },
  pancake:       { name: 'Pancake', cart: 'bread', shape: 'pancake', color: '#e6a95a' },
  butter:        { name: 'Butter', cart: 'dairy', shape: 'butter', color: '#ffe58a' },
  maple:         { name: 'Maple Syrup', cart: 'sweet', shape: 'syrupTop', color: '#b8651b' },
  chocSyrup:     { name: 'Chocolate Syrup', cart: 'sweet', shape: 'syrupTop', color: '#4a2511' },
  strawberries:  { name: 'Strawberries', cart: 'veg', shape: 'fruit', item: 'straw', color: '#e8344a' },
  blueberries:   { name: 'Blueberries', cart: 'veg', shape: 'fruit', item: 'blue', color: '#3b4cc0' },
  banana:        { name: 'Banana Slices', cart: 'veg', shape: 'fruit', item: 'banana', color: '#fff1a8' },
  // --- cupcake ---
  liner:         { name: 'Cupcake Liner', cart: 'bread', shape: 'liner', color: '#ff7eb6' },
  cakeVanilla:   { name: 'Vanilla Cake', cart: 'bread', shape: 'cakeTop', color: '#f3d29a' },
  cakeChoc:      { name: 'Chocolate Cake', cart: 'bread', shape: 'cakeTop', color: '#6b3e26' },
  cakeRed:       { name: 'Red Velvet Cake', cart: 'bread', shape: 'cakeTop', color: '#a8182c' },
  frostVanilla:  { name: 'Vanilla Frosting', cart: 'sweet', shape: 'frosting', color: '#fffaf0' },
  frostChoc:     { name: 'Chocolate Frosting', cart: 'sweet', shape: 'frosting', color: '#7b4a2e' },
  frostStraw:    { name: 'Strawberry Frosting', cart: 'sweet', shape: 'frosting', color: '#ffb3d1' },
  cupSprinkles:  { name: 'Rainbow Sprinkles', cart: 'sweet', shape: 'cupSprinkles' },
};

/* Option helpers. An option maps a player choice to printed ingredient layers.
   tags are used by customer preferences and the AI insight system. */
const opt = (id, label, layers, tags = []) => ({ id, label, layers, tags });

/* FOODS
   groups:   what the player can customise ('single' = pick one, 'multi' = toggles)
   printing: the order layers are printed. Strings are fixed layers,
             {group} inserts the chosen option(s), {group, key:'top'} inserts option.top.
   form:     how the renderer arranges the layers. */
const FOODS = [
  {
    id: 'burger', name: 'Burger', emoji: '🍔', price: 12, unlock: 1,
    displayName: (s) => (s.cheese === 'double' ? 'Double Cheeseburger' : s.cheese !== 'none' ? 'Cheeseburger' : 'Hamburger'),
    groups: [
      { id: 'protein', label: 'Protein', type: 'single', default: 'beef', options: [
        opt('beef', 'Beef', ['beefPatty']), opt('chicken', 'Chicken', ['chickenPatty']), opt('veggie', 'Veggie', ['veggiePatty'], ['veggie'])] },
      { id: 'cheese', label: 'Cheese', type: 'single', default: 'cheddar', options: [
        opt('none', 'None', []), opt('cheddar', 'Cheddar', ['cheddar']), opt('american', 'American', ['american']),
        opt('double', 'Extra Cheese', ['cheddar', 'american'], ['extra-cheese'])] },
      { id: 'toppings', label: 'Toppings', type: 'multi', default: ['lettuce', 'tomato'], options: [
        opt('lettuce', 'Lettuce', ['lettuce'], ['veggie']), opt('tomato', 'Tomato', ['tomato'], ['veggie']),
        opt('pickles', 'Pickles', ['pickles']), opt('onion', 'Onion', ['onion'], ['onion'])] },
      { id: 'sauce', label: 'Sauce', type: 'single', default: 'ketchup', options: [
        opt('none', 'None', []), opt('ketchup', 'Ketchup', ['ketchup']), opt('mustard', 'Mustard', ['mustard']),
        opt('special', 'Special Sauce', ['specialSauce'])] },
    ],
    printing: ['bunBottom', { group: 'protein' }, { group: 'cheese' }, { group: 'toppings' }, { group: 'sauce' }, 'bunTop'],
  },
  {
    id: 'pizza', name: 'Pizza', emoji: '🍕', price: 14, unlock: 1,
    displayName: (s) => (s.toppings.includes('pepperoni') ? 'Pepperoni Pizza' : s.toppings.length === 0 ? 'Cheese Pizza' : 'Custom Pizza'),
    groups: [
      { id: 'sauce', label: 'Sauce', type: 'single', default: 'tomato', options: [
        opt('tomato', 'Tomato', ['tomatoSauce']), opt('bbq', 'BBQ', ['bbqSauce']), opt('pesto', 'Pesto', ['pesto'], ['veggie'])] },
      { id: 'cheese', label: 'Cheese', type: 'single', default: 'mozz', options: [
        opt('none', 'None', []), opt('mozz', 'Mozzarella', ['mozzarella']), opt('extra', 'Extra Cheese', ['mozzarella', 'mozzarella'], ['extra-cheese'])] },
      { id: 'toppings', label: 'Toppings', type: 'multi', default: ['pepperoni'], options: [
        opt('pepperoni', 'Pepperoni', ['pepperoni']), opt('mushrooms', 'Mushrooms', ['mushrooms'], ['veggie']),
        opt('peppers', 'Peppers', ['peppers'], ['veggie', 'spicy']), opt('olives', 'Olives', ['olives'], ['veggie']),
        opt('pineapple', 'Pineapple', ['pineapple'], ['sweet'])] },
      { id: 'finish', label: 'Finishing Layer', type: 'single', default: 'basil', options: [
        opt('none', 'None', []), opt('basil', 'Basil', ['basil']), opt('oregano', 'Oregano', ['oregano'])] },
    ],
    printing: ['dough', { group: 'sauce' }, { group: 'cheese' }, { group: 'toppings' }, { group: 'finish' }],
  },
  {
    id: 'tacos', name: 'Taco', emoji: '🌮', price: 9, unlock: 1,
    groups: [
      { id: 'shell', label: 'Shell', type: 'single', default: 'hard', options: [
        opt('hard', 'Hard Corn', ['hardShell']), opt('soft', 'Soft Flour', ['softShell'])] },
      { id: 'meat', label: 'Filling', type: 'single', default: 'beef', options: [
        opt('beef', 'Beef', ['tacoBeef']), opt('chicken', 'Chicken', ['tacoChicken']), opt('beans', 'Black Beans', ['beans'], ['veggie'])] },
      { id: 'cheese', label: 'Cheese', type: 'single', default: 'cheddar', options: [
        opt('none', 'None', []), opt('cheddar', 'Cheddar', ['tacoCheese']), opt('extra', 'Extra Cheese', ['tacoCheese', 'tacoCheese'], ['extra-cheese'])] },
      { id: 'veg', label: 'Veggies', type: 'multi', default: ['lettuce', 'tomato'], options: [
        opt('lettuce', 'Lettuce', ['tacoLettuce'], ['veggie']), opt('tomato', 'Tomato', ['tacoTomato'], ['veggie']), opt('onion', 'Onion', ['tacoOnion'], ['onion'])] },
      { id: 'top', label: 'Topping', type: 'single', default: 'sourcream', options: [
        opt('none', 'None', []), opt('sourcream', 'Sour Cream', ['sourCream']), opt('guac', 'Guacamole', ['guac'], ['veggie']), opt('salsa', 'Hot Salsa', ['salsa'], ['spicy'])] },
    ],
    printing: [{ group: 'shell' }, { group: 'meat' }, { group: 'cheese' }, { group: 'veg' }, { group: 'top' }],
  },
  {
    id: 'hotdog', name: 'Hot Dog', emoji: '🌭', price: 8, unlock: 1, form: 'wide',
    groups: [
      { id: 'dog', label: 'Sausage', type: 'single', default: 'beef', options: [
        opt('beef', 'Beef Frank', ['beefFrank']), opt('chicken', 'Chicken', ['chickenFrank']), opt('veggie', 'Veggie Dog', ['veggieDog'], ['veggie'])] },
      { id: 'toppings', label: 'Toppings', type: 'multi', default: ['relish'], options: [
        opt('onion', 'Onion', ['hdOnion'], ['onion']), opt('relish', 'Relish', ['relish']), opt('jalapenos', 'Jalapeños', ['jalapenos'], ['spicy'])] },
      { id: 'sauces', label: 'Sauces', type: 'multi', default: ['ketchup', 'mustard'], options: [
        opt('ketchup', 'Ketchup', ['hdKetchup']), opt('mustard', 'Mustard', ['hdMustard'])] },
    ],
    printing: ['hotdogBun', { group: 'dog' }, { group: 'toppings' }, { group: 'sauces' }],
  },
  {
    id: 'chickensandwich', name: 'Chicken Sandwich', emoji: '🍗', price: 11, unlock: 2,
    groups: [
      { id: 'chicken', label: 'Chicken', type: 'single', default: 'crispy', options: [
        opt('crispy', 'Crispy', ['crispyChicken']), opt('grilled', 'Grilled', ['grilledChicken']), opt('spicy', 'Spicy', ['spicyChicken'], ['spicy'])] },
      { id: 'cheese', label: 'Cheese', type: 'single', default: 'none', options: [
        opt('none', 'None', []), opt('american', 'American', ['american']), opt('pepperjack', 'Pepper Jack', ['pepperJack'], ['spicy']),
        opt('double', 'Extra Cheese', ['american', 'pepperJack'], ['extra-cheese'])] },
      { id: 'toppings', label: 'Toppings', type: 'multi', default: ['lettuce', 'pickles'], options: [
        opt('lettuce', 'Lettuce', ['lettuce'], ['veggie']), opt('tomato', 'Tomato', ['tomato'], ['veggie']), opt('pickles', 'Pickles', ['pickles'])] },
      { id: 'sauce', label: 'Sauce', type: 'single', default: 'mayo', options: [
        opt('none', 'None', []), opt('mayo', 'Mayo', ['mayo']), opt('spicymayo', 'Spicy Mayo', ['spicyMayo'], ['spicy']), opt('honey', 'Honey Mustard', ['honeyMustard'])] },
    ],
    printing: ['briocheBottom', { group: 'chicken' }, { group: 'cheese' }, { group: 'toppings' }, { group: 'sauce' }, 'briocheTop'],
  },
  {
    id: 'fries', name: 'Fries', emoji: '🍟', price: 5, unlock: 2,
    dipSlots: [[118, 8]],
    groups: [
      { id: 'size', label: 'Size', type: 'single', default: 'regular', options: [
        opt('regular', 'Regular', ['friesReg']), opt('large', 'Large', ['friesLarge'], ['big'])] },
      { id: 'season', label: 'Seasoning', type: 'single', default: 'salt', options: [
        opt('none', 'None', []), opt('salt', 'Sea Salt', ['salt']), opt('cajun', 'Cajun', ['cajun'], ['spicy'])] },
      { id: 'dip', label: 'Dip', type: 'single', default: 'ketchup', options: [
        opt('none', 'None', []), opt('ketchup', 'Ketchup', ['dipKetchup']), opt('cheese', 'Cheese Sauce', ['dipCheese'], ['extra-cheese'])] },
    ],
    printing: ['friesBox', { group: 'size' }, { group: 'season' }, { group: 'dip' }],
  },
  {
    id: 'sandwich', name: 'Sandwich', emoji: '🥪', price: 10, unlock: 2,
    groups: [
      { id: 'bread', label: 'Bread', type: 'single', default: 'white', options: [
        { ...opt('white', 'White', ['whiteBread']), top: ['whiteBread'] },
        { ...opt('wheat', 'Wheat', ['wheatBread']), top: ['wheatBread'] },
        { ...opt('rye', 'Rye', ['ryeBread']), top: ['ryeBread'] }] },
      { id: 'meat', label: 'Meat', type: 'single', default: 'turkey', options: [
        opt('turkey', 'Turkey', ['turkey']), opt('ham', 'Ham', ['ham']), opt('none', 'No Meat', [], ['veggie'])] },
      { id: 'cheese', label: 'Cheese', type: 'single', default: 'swiss', options: [
        opt('none', 'None', []), opt('swiss', 'Swiss', ['swiss']), opt('cheddar', 'Cheddar', ['cheddar']),
        opt('double', 'Extra Cheese', ['swiss', 'cheddar'], ['extra-cheese'])] },
      { id: 'veg', label: 'Veggies', type: 'multi', default: ['lettuce', 'tomato'], options: [
        opt('lettuce', 'Lettuce', ['lettuce'], ['veggie']), opt('tomato', 'Tomato', ['tomato'], ['veggie']),
        opt('cucumber', 'Cucumber', ['cucumber'], ['veggie']), opt('onion', 'Onion', ['onion'], ['onion'])] },
      { id: 'spread', label: 'Spread', type: 'single', default: 'mayo', options: [
        opt('none', 'None', []), opt('mayo', 'Mayo', ['mayo']), opt('mustard', 'Mustard', ['mustard'])] },
    ],
    printing: [{ group: 'bread' }, { group: 'meat' }, { group: 'cheese' }, { group: 'veg' }, { group: 'spread' }, { group: 'bread', key: 'top' }],
  },
  {
    id: 'donut', name: 'Donut', emoji: '🍩', price: 4, unlock: 3,
    groups: [
      { id: 'dough', label: 'Dough', type: 'single', default: 'classic', options: [
        opt('classic', 'Classic', ['donutClassic']), opt('choc', 'Chocolate', ['donutChoc'], ['sweet'])] },
      { id: 'glaze', label: 'Glaze', type: 'single', default: 'straw', options: [
        opt('none', 'None', []), opt('straw', 'Strawberry', ['glazeStraw']), opt('choc', 'Chocolate', ['glazeChoc'], ['sweet']), opt('vanilla', 'Vanilla', ['glazeVanilla'])] },
      { id: 'top', label: 'Topping', type: 'single', default: 'sprinkles', options: [
        opt('none', 'None', []), opt('sprinkles', 'Sprinkles', ['donutSprinkles'], ['sweet']), opt('chips', 'Choc Chips', ['chocChips'], ['sweet'])] },
    ],
    printing: [{ group: 'dough' }, { group: 'glaze' }, { group: 'top' }],
  },
  {
    id: 'icecream', name: 'Ice Cream', emoji: '🍦', price: 6, unlock: 3,
    groups: [
      { id: 'base', label: 'Holder', type: 'single', default: 'cone', options: [
        opt('cone', 'Waffle Cone', ['waffleCone']), opt('cup', 'Cup', ['iceCup'])] },
      { id: 'scoop1', label: 'First Scoop', type: 'single', default: 'vanilla', options: [
        opt('vanilla', 'Vanilla', ['vanilla']), opt('chocolate', 'Chocolate', ['chocolate'], ['sweet']), opt('strawberry', 'Strawberry', ['strawberry']), opt('mint', 'Mint Chip', ['mint'])] },
      { id: 'scoop2', label: 'Second Scoop', type: 'single', default: 'none', options: [
        opt('none', 'None', []), opt('vanilla', 'Vanilla', ['vanilla'], ['big']), opt('chocolate', 'Chocolate', ['chocolate'], ['big', 'sweet']),
        opt('strawberry', 'Strawberry', ['strawberry'], ['big']), opt('mint', 'Mint Chip', ['mint'], ['big'])] },
      { id: 'toppings', label: 'Toppings', type: 'multi', default: ['sprinkles'], options: [
        opt('syrup', 'Choc Syrup', ['icSyrup'], ['sweet']), opt('whipped', 'Whipped Cream', ['whipped'], ['sweet']),
        opt('sprinkles', 'Sprinkles', ['icSprinkles'], ['sweet']), opt('cherry', 'Cherry', ['cherry'], ['sweet'])] },
    ],
    // multi options print in the order listed, so whipped cream lands under sprinkles & cherry
    printing: [{ group: 'base' }, { group: 'scoop1' }, { group: 'scoop2' }, { group: 'toppings' }],
  },
  {
    id: 'pancakes', name: 'Pancakes', emoji: '🥞', price: 9, unlock: 3,
    groups: [
      { id: 'stack', label: 'Stack', type: 'single', default: 'three', options: [
        opt('two', '2 Pancakes', ['pancake', 'pancake']), opt('three', '3 Pancakes', ['pancake', 'pancake', 'pancake']),
        opt('four', '4 Pancakes', ['pancake', 'pancake', 'pancake', 'pancake'], ['big'])] },
      { id: 'butter', label: 'Butter', type: 'single', default: 'yes', options: [
        opt('no', 'None', []), opt('yes', 'Butter', ['butter'])] },
      { id: 'syrup', label: 'Syrup', type: 'single', default: 'maple', options: [
        opt('none', 'None', []), opt('maple', 'Maple', ['maple']), opt('choc', 'Chocolate', ['chocSyrup'], ['sweet'])] },
      { id: 'fruit', label: 'Fruit', type: 'multi', default: ['blueberries'], options: [
        opt('strawberries', 'Strawberries', ['strawberries'], ['veggie']), opt('blueberries', 'Blueberries', ['blueberries'], ['veggie']),
        opt('banana', 'Banana', ['banana'], ['veggie'])] },
    ],
    printing: ['plate', { group: 'stack' }, { group: 'butter' }, { group: 'syrup' }, { group: 'fruit' }],
  },
  {
    id: 'cupcake', name: 'Cupcake', emoji: '🧁', price: 5, unlock: 4,
    groups: [
      { id: 'cake', label: 'Cake', type: 'single', default: 'vanilla', options: [
        opt('vanilla', 'Vanilla', ['cakeVanilla']), opt('choc', 'Chocolate', ['cakeChoc'], ['sweet']), opt('red', 'Red Velvet', ['cakeRed'])] },
      { id: 'frosting', label: 'Frosting', type: 'single', default: 'straw', options: [
        opt('vanilla', 'Vanilla', ['frostVanilla']), opt('choc', 'Chocolate', ['frostChoc'], ['sweet']), opt('straw', 'Strawberry', ['frostStraw'])] },
      { id: 'toppings', label: 'Toppings', type: 'multi', default: ['sprinkles'], options: [
        opt('sprinkles', 'Sprinkles', ['cupSprinkles'], ['sweet']), opt('cherry', 'Cherry', ['cherry'], ['sweet'])] },
    ],
    printing: ['liner', { group: 'cake' }, { group: 'frosting' }, { group: 'toppings' }],
  },
  {
    id: 'nuggets', name: 'Chicken Nuggets', emoji: '🍗', price: 7, unlock: 4,
    dipSlots: [[-78, 52], [0, 62], [78, 52]],
    groups: [
      { id: 'count', label: 'Amount', type: 'single', default: 'six', options: [
        opt('six', '6 Pieces', ['nug6']), opt('ten', '10 Pieces', ['nug10'], ['big'])] },
      { id: 'dips', label: 'Dips', type: 'multi', default: ['bbq'], options: [
        opt('ketchup', 'Ketchup', ['dipKetchup']), opt('bbq', 'BBQ', ['dipBbq']), opt('honey', 'Honey Mustard', ['dipHoney']),
        opt('cheese', 'Cheese Sauce', ['dipCheese'], ['extra-cheese'])] },
    ],
    printing: ['nugTray', { group: 'count' }, { group: 'dips' }],
  },
];

const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

const LEVELS = [
  { level: 1, title: 'Trainee Operator', ordersNeeded: 0 },
  { level: 2, title: 'Print Technician', ordersNeeded: 3 },
  { level: 3, title: 'AI Chef', ordersNeeded: 6 },
  { level: 4, title: 'Food Futurist', ordersNeeded: 9 },
];

/* CUSTOMERS. prefs/avoid are tags (see options above). The AI insight
   system "learns" these by looking only at each customer's past orders. */
const CUSTOMERS = [
  { id: 'jack', name: 'Jack', prefs: ['extra-cheese'], avoid: [], favs: ['burger', 'pizza', 'tacos', 'sandwich', 'fries'],
    look: { type: 'human', skin: '#f1c27d', hair: '#4a2f1d', hairStyle: 'short', shirt: '#3f8efc', acc: 'cap', accColor: '#ff4d6d' } },
  { id: 'maya', name: 'Maya', prefs: ['veggie'], avoid: ['onion'], favs: ['pizza', 'tacos', 'sandwich', 'pancakes'],
    look: { type: 'human', skin: '#8d5524', hair: '#1b1b1b', hairStyle: 'puffs', shirt: '#2fd1a5', acc: 'none' } },
  { id: 'leo', name: 'Leo', prefs: ['spicy'], avoid: [], favs: ['hotdog', 'tacos', 'chickensandwich', 'fries'],
    look: { type: 'human', skin: '#e0ac69', hair: '#c46a1a', hairStyle: 'spiky', shirt: '#ff8a3d', acc: 'glasses' } },
  { id: 'priya', name: 'Priya', prefs: ['sweet'], avoid: ['onion'], favs: ['donut', 'icecream', 'pancakes', 'cupcake', 'pizza'],
    look: { type: 'human', skin: '#c68642', hair: '#2a1a12', hairStyle: 'long', shirt: '#a66cff', acc: 'headphones', accColor: '#ffffff' } },
  { id: 'b7', name: 'Unit B-7', prefs: ['big'], avoid: [], favs: ['nuggets', 'fries', 'burger', 'hotdog'],
    look: { type: 'robot', body: '#9fb6cc', eye: '#3ff2ff', shirt: '#58708a' } },
  { id: 'zoe', name: 'Zoe', prefs: ['extra-cheese', 'sweet'], avoid: [], favs: ['pizza', 'cupcake', 'burger', 'icecream'],
    look: { type: 'human', skin: '#ffdbac', hair: '#f2d16b', hairStyle: 'bun', shirt: '#ff5fa2', acc: 'none' } },
  { id: 'omar', name: 'Omar', prefs: ['spicy'], avoid: [], favs: ['chickensandwich', 'tacos', 'burger', 'nuggets'],
    look: { type: 'human', skin: '#a1665e', hair: '#151515', hairStyle: 'curly', shirt: '#2b6cff', acc: 'beard' } },
  { id: 'ava', name: 'Ava', prefs: ['veggie'], avoid: [], favs: ['sandwich', 'pizza', 'icecream', 'pancakes', 'donut'],
    look: { type: 'human', skin: '#f6d0b1', hair: '#7a2f1d', hairStyle: 'long', shirt: '#ffc23d', acc: 'glasses' } },
];
const CUSTOMER_BY_ID = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]));

// First few customers are scripted so a returning customer (and an AI insight) appears early in a demo.
const SCRIPTED_VISITS = ['jack', 'maya', 'jack', 'leo', 'jack', 'maya'];

const TAG_INFO = {
  'extra-cheese': { text: 'frequently orders extra cheese', rec: 'Extra Cheese' },
  veggie: { text: 'prefers vegetarian and veggie-packed options', rec: 'Veggie choices' },
  spicy: { text: 'loves spicy food', rec: 'Spicy options' },
  sweet: { text: 'has a sweet tooth', rec: 'Sweet toppings' },
  big: { text: 'usually orders the largest size', rec: 'Large portions' },
  onion: { text: 'always skips onions', rec: 'No onion' },
};

const DIALOGUE = {
  greet: [
    'Hi! Can I get a {food}?',
    "I'll try the AI special — one {food}, please!",
    'One {food}, please. I heard the printer is amazing!',
    'Hey there! {food} time!',
    "I'm starving. {food}, please!",
    'Could you print me a {food}?',
  ],
  returning: [
    "I'm back! Another {food}, please.",
    'Hi again! Let me get a {food}.',
    'You know me — {food}, please!',
  ],
  robot: ['GREETINGS. REQUESTING ONE (1) {food}.', 'BEEP. FUEL REQUIRED: {food}.'],
  perfect: ['10/10!', 'That looks amazing!', 'Wow, printed to perfection!', 'Exactly what I wanted!'],
  good: ['Pretty good!', 'Really tasty!', 'Nice, almost perfect!'],
  okay: ['Hmm, not quite what I asked for.', "It's okay, I guess."],
  bad: ["This isn't what I ordered...", 'Uh... did the AI glitch?'],
  wrongFood: ['I ordered a {food}, not a {other}!'],
  missingCheese: ['Could use more cheese.'],
  missing: ['Hmm, I asked for {item}.', 'Where is the {item}?'],
  extra: ["I didn't ask for {item}..."],
  waiting: ['Mmm, smells futuristic!', 'Is that a 3D printer? Cool!', 'Take your time!'],
};
