# 🤖 AI Food Factory

**The future of food is here.** A playable school-project cooking game about AI-assisted food production.

> **HUMANS CREATE · AI ASSISTS · AUTOMATION FINISHES**

Customers walk into a futuristic restaurant and order food. **You** cook it: grill and flip the patties, drop fries in the fryer, stretch and bake pizzas, warm taco shells, stack burgers, and pour drinks.
An **AI assistant** reads the ticket, recommends cooking times, suggests the stacking order and scans your finished food for mistakes.
Then a **3D food printer** runs a short cinematic "synthesis" that rebuilds your food layer by layer before you serve it.

## ▶ How to run

No install, no internet, no API key, no login.

1. Download this repository: **Code ▸ Download ZIP**, then unzip it.
2. Double-click **`index.html`** to open it in Chrome, Edge, Firefox or Safari. It's a single self-contained file, so it works even if it's copied on its own.
3. Click **START GAME**. Sound starts after the first click; use the 🔊 button to adjust music and effects.

## 🎮 How to play

1. **Take the order.** Read the ticket (food, cook level, toppings, side, drink), then press **TAKE ORDER**.
2. **Cook.** The station bar at the bottom highlights the stations you need (keys **1–8** switch stations):
   - 🔥 **Grill:** put a raw patty on, **ignite**, watch the meter, **flip** in the green zone, then **take** it off in the green zone again. Undercooked or burnt food lowers your score.
   - 🍟 **Fryer:** load the basket, **drop** it into the oil, **lift** it when it's golden. Fries then get seasoned and boxed.
   - 🍕 **Pizza:** dough ball → **stretch** → sauce, cheese, toppings → **oven** → take it out at the right time.
   - 🌮 **Taco:** warm the shell, move it to the holder, add the fillings.
   - 🍔 **Prep** and 🍨 **Dessert:** stack the food one ingredient at a time. It builds right in front of you.
   - 🥤 **Drinks:** pick a flavor, **hold to fill**, and release at the pink line.
3. **AI quality check.** Press **FINISH**. The AI scans the food for the correct food, ingredients, cooking, customization and presentation. Use **FIX IT** to correct mistakes, or **SEND TO 3D PRINTER**.
4. **3D synthesis.** Watch the cutscene: the chamber seals, the AI verifies the recipe, cartridges and robotic arms build the food layer by layer, and a quality score appears. Press **SKIP ▶▶** or Space to jump ahead.
5. **Serve.** Press **SERVE ORDER**. The customer reacts with hearts, and you're scored on **Accuracy, Cooking, Speed and Presentation** to earn money and XP.

Difficulty ramps up: a simple burger → a burger with toppings → pizza → tacos → burger + fries + drink, then more recipes unlock as you level up (11 foods in total).

## ✨ What's inside

- **7 interactive stations** drawn as physical equipment: grill with flames and two-sided cooking, fryer with bubbling oil and baskets, pizza table and oven, taco warmer, prep counter, dessert bar and drink fountain. A shared heat-lamp shelf holds cooked items.
- **Food that visibly changes**: patties go from pink to brown to burnt and get grill marks; fries, donuts, pizza crust and shells all brown as they cook.
- **Layer-by-layer assembly**: every ingredient drops onto the stack, so a burger really is bun → sauce → lettuce → patty → cheese → top bun.
- **AI Assist panel**: shows the next step, recommended cook times, recommended stacking order and personalization tips.
- **AI customer insight** (with permission): returning customers' preferences are learned from their past orders, and AI PICK tags appear on the matching ingredients.
- **Upgraded 3D printer**: sealing glass door, two robotic arms, a moving nozzle, glowing cartridges, steam, a status screen, a quality score and an output tray.
- **8 customers with personalities**, idle animations, walking, reactions and ❤️ ratings.
- **Procedural sound and music**: layered sizzle, fryer, oven and printer loops; footsteps; UI sounds; background music that changes during the synthesis cutscene. Volume sliders for master, music and effects.
- **How It Works** and **Responsible AI** panels for the presentation.

## 🧠 About the "AI"

**This prototype simulates AI-assisted food production.** The "AI" is programmed logic (rules, comparisons and simple pattern counting) that *demonstrates* what an AI assistant could do. It is not a trained machine-learning model, and the game does not represent technology that is available today.

## 🗂 Project structure

```
index.html        THE GAME — one self-contained file (built from the files below)
dev.html          Source page layout: restaurant, kitchen layer, HUD, ticket, panels
tools/build.js    Bundles dev.html + css/ + js/ into index.html  (run: node tools/build.js)
js/compat.js      Polyfills for older browsers + on-screen error message
css/style.css     All styling and animations
js/data.js        Foods, ingredients, cooking times, customers, levels, dialogue  ← add content here
js/renderer.js    Procedural drawing of every food layer, drinks and customers (no image files)
js/audio.js       Synthesized sound effects, looping kitchen sounds and background music
js/ai.js          Simulated AI: orders, tickets, quality check, scoring, reactions, insights
js/kitchen.js     The cooking stations: equipment drawing, cooking timers, buttons
js/printer.js     The 3D food printer and the synthesis cutscene timeline
js/game.js        Game flow, navigation, serving, results, main loop
```

### Adding a new food

In `js/data.js`, add its ingredients to `INGREDIENTS` (reusing a `shape` from `renderer.js`), then add an entry to `FOODS` with its `station`, `unlock` level, customization `groups` and `printing` order. To make an ingredient cookable, add it to `COOK_INFO`. The stations, ticket, AI check, printer and scoring pick the new food up automatically. Test with `dev.html`, then run `node tools/build.js` to update `index.html`.

## 👥 Credits

Original concept for a school project. Every character, food, machine and sound is generated with code. Fonts are Orbitron and Nunito from Google Fonts; if they can't load, the game falls back to system fonts.
