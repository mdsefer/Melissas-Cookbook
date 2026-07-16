# 🍳 Melissa's Cookbook

A cozy little static recipe site — made with love, for two.

Add any recipe you've made or want to make, browse by category, scale ingredients
to your serving size, and generate a shopping list with one click. Everything is
saved right in your browser, so there's no server or database to run.

## Use it

**Live site:** https://mdsefer.github.io/Melissas-Cookbook/ — bookmark it, add it to
your phone's home screen, done. (Opening `index.html` locally also works.)

## How sharing works 💕

Melissa's browser is the master cookbook. The live site serves whatever is in
`recipes.json` — the *published* cookbook — so both of us always see the same thing.

**To publish new recipes (or made-it marks, faves, edits):**

1. In the cookbook, click the **⋯ menu → Export recipes** (downloads a file)
2. Double-click **`publish.bat`** in this folder
3. Wait a minute, tell him to refresh 👀

Local changes on other devices never overwrite the published cookbook — only
publishing updates it.

## Features

- 🗂️ **Categories** — Breakfast, Snacks, Meals, **Meal Prep** 🍱, Desserts, Drinks, Other
- 💖 **Tried & true vs. ✨ on the wishlist** — track what you've made and what you're dreaming about
- ⭐ **Favorites** — heart the keepers, filter to just the faves
- 🎲 **"Pick for us!"** — can't decide? let fate choose dinner
- ➕ **Add / edit recipes** — ingredients, steps, time, photo, and notes
- 🍽️ **Serving-size scaling** — amounts rescale automatically (with nice fractions)
- 🛒 **Shopping list** — scaled to your servings, with copy & print
- 🔍 **Search** — by recipe name or ingredient
- ⬇️⬆️ **Export / Import** — back up your recipes or share them as a file
- 🎉 **Confetti** — because marking a recipe "made" deserves a tiny party
- 📔 **Our diary** — dated entries with the recipe, a heart rating, a photo, and the memory

## Files

| File | What it is |
|------|------------|
| `index.html` | Page structure |
| `styles.css` | All the styling |
| `app.js`     | App logic + browser storage |

## Backups & sharing

Recipes live in your browser's local storage (per device). Use the **⋯ menu → Export**
to download a backup file, and **Import** to load it on another device or share it.
