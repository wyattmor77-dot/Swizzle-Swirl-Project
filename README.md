# 🤖 AI Food Factory

**The future of food is here.** A playable school-project prototype that shows how artificial intelligence
could personalize customer experiences and control an automated 3D food printer.

Customers walk into a futuristic restaurant and order food. You build each order at the Food Station,
an AI system analyzes it and plans the print, and a 3D food printer builds the meal **layer by layer**
while you watch. Then you serve it, see the customer's reaction and earn money.

## ▶ How to run

No install, no internet, no API key, no login.

1. Download or clone this repository.
2. Double-click **`index.html`** to open it in Chrome, Edge, Firefox or Safari.
3. Click **START GAME**.

(Optional) To serve it locally instead: `npx serve .` and open the URL it prints.

## 🎮 How to play

1. A customer arrives and says what they want. Their **order ticket** appears in the middle.
2. Click **START ORDER**. In the **Food Station**, pick the food they asked for, then match every ingredient on the ticket.
3. Click **PRINT FOOD** and watch the cutscene:
   - the **AI Food System** panel analyzes the order and generates a recipe,
   - the camera zooms in on the printer,
   - the nozzle moves, cartridges light up, and the food is printed **one layer at a time**,
   - the finished food slides onto the output tray.
   Press **SKIP ▶▶** (or Space) to jump to the end.
4. Click **SERVE FOOD**. The customer reacts, and you get a score for accuracy, speed, stars and money.
5. Click **NEXT CUSTOMER** and keep playing. Every 3 orders you level up and unlock new recipes.

## ✨ Features

- **12 foods:** Burger, Pizza, Taco, Hot Dog, Chicken Sandwich, Fries, Sandwich, Donut, Ice Cream, Pancakes, Cupcake and Chicken Nuggets. Each has its own ingredients, options and printing order.
- **3D food printer:** six ingredient cartridges, a gantry-mounted robotic nozzle, a glass printing chamber, a print platform, an "AI core" chip, gears, pistons, a digital status screen with a progress bar, and an output tray.
- **Real layer-by-layer printing:** a laser scan line reveals each ingredient from the bottom up, so what you choose changes what gets printed.
- **Simulated AI system:** order analysis, recipe generation, print sequencing and a check against the ticket. When your build differs from the ticket, the AI flags it but keeps the human operator's choice.
- **AI personalization:** returning customers trigger an **AI CUSTOMER INSIGHT**, for example "This customer frequently orders extra cheese." The Food Station then shows an "AI PICK" suggestion.
- **Responsible AI panel:** covers privacy, bias, copyright, human oversight and workforce impact.
- **About the Technology panel:** explains how the AI pipeline works, and that the prototype simulates AI logic and does not make edible food.
- **Scoring:** order accuracy, speed, a 1–5 star rating, earnings with tips, and a running money total and average rating.
- **Synthesized sound effects:** made with the Web Audio API, with a mute button in the top bar.
- **Responsive layout:** the 1600×900 game stage scales to fit any desktop window.

## 🧠 About the "AI"

This prototype uses **programmed logic** (rules, comparisons and simple pattern counting) to *demonstrate* how an AI
system could analyze orders, plan a print and personalize recommendations. It is not a trained machine-learning model,
and it does not claim the machine can make real edible food. Everything runs offline in the browser.

## 🗂 Project structure

```
index.html        Page layout: restaurant, HUD, panels, modals
css/style.css     All styling and animations
js/data.js        Foods, ingredients, cartridges, customers, dialogue  ← edit this to add content
js/renderer.js    Procedural drawing of every food layer + customer avatars (no image files)
js/ai.js          Simulated AI: order generation, analysis, scoring, reactions, insights
js/printer.js     The 3D food printer drawing + the timed printing cutscene
js/audio.js       Generated sound effects
js/game.js        Game loop, UI and flow control
```

### Adding a new food

In `js/data.js`:

1. Add any new ingredients to `INGREDIENTS`, reusing an existing `shape` from `renderer.js` (for example `patty`, `sauce` or `lettuce`).
2. Add an entry to `FOODS` with a `name`, `emoji`, `price`, `unlock` level, customization `groups`, and a `printing` order.

The Food Station, ticket, printer, AI analysis and scoring all pick up the new food automatically.

## 👥 Credits

Original game concept, characters and artwork are all generated with code for this school project. Fonts are
Orbitron and Nunito from Google Fonts; if they can't load, the game falls back to system fonts.
