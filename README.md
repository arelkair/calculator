# Calculator

A modern, minimalist and responsive scientific calculator built with plain HTML, CSS and JavaScript. No build step, no dependencies.

## Features

- Expression engine with parentheses, precedence and unary minus
- Scientific functions: trigonometry with inverses, logarithms, roots, powers, factorial, percentage
- Constants pi and e, plus a DEG/RAD toggle
- Light and dark themes with a circular reveal transition and persistence
- Persistent calculation history, tap an entry to reuse its result
- Tap the result to copy it, with a toast confirmation
- Full keyboard support and reduced-motion support

## Structure

```
src/
  index.html      Markup and key layout
  css/styles.css  Theme tokens, layout and responsive styles
  js/main.js      Calculator state and input logic
  favicon.svg     Icon
  vercel.json     Headers and caching for deployment
```

## Run locally

Open `src/index.html` in any browser.

## Deploy

Hosted on Vercel. The project Root Directory is set to `src`.
