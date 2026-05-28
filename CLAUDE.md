# Calculator

A modern, minimalist and responsive web calculator built with plain HTML, CSS and JavaScript.

## Structure

- `src/index.html` - Markup and key layout
- `src/css/styles.css` - Theme tokens, layout and responsive styles
- `src/js/main.js` - Calculator state and input logic

## Features

- Expression engine with parentheses, precedence and unary minus (tokenizer, shunting-yard, RPN)
- Scientific functions: trigonometry with inverse (2nd), logarithms, roots, powers, factorial, percentage
- Constants pi and e, plus DEG/RAD toggle
- Light and dark themes with a circular reveal transition (View Transitions API) and persistence
- Calculation history panel: persistent, tap an entry to reuse its result
- Tap the result to copy it to the clipboard with a toast confirmation
- Live result preview, full keyboard support and error state in red
- Animated background, grain texture, staggered key entrance and tactile press feedback
- Responsive layout with reduced-motion support

## Run

Open `src/index.html` in any browser. No build step or dependencies required.
