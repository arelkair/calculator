const primaryEl = document.getElementById("primary");
const primaryWrap = document.getElementById("primaryWrap");
const displayMeta = document.getElementById("displayMeta");
const metaCount = document.getElementById("metaCount");
const secondaryEl = document.getElementById("secondary");
const secondKey = document.getElementById("secondKey");
const angleKey = document.getElementById("angleKey");
const themeToggle = document.getElementById("themeToggle");
const historyToggle = document.getElementById("historyToggle");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const historyClear = document.getElementById("historyClear");
const scrim = document.getElementById("scrim");
const toast = document.getElementById("toast");
const keysContainer = document.querySelector(".keys");

const state = {
  expression: "",
  history: "",
  evaluated: false,
  second: false,
  degrees: true
};

const altButtons = [...document.querySelectorAll("[data-value2]")];

const multiCharTokens = [
  "asin(", "acos(", "atan(", "sin(", "cos(", "tan(",
  "log(", "ln(", "10^(", "e^(", "√(", "∛(", "⁻¹"
];

const precedence = { "+": 2, "-": 2, "*": 3, "/": 3, "u": 4, "^": 5 };
const rightAssociative = { "^": true, "u": true };

const PRECISION = 100;
const DISPLAY_DIGITS = 40;
const ZERO_SNAP = "1e-90";
const FACTORIAL_LIMIT = 5000;
const MAX_POWER_DIGITS = 20000;

Decimal.set({ precision: PRECISION });

let cachedPi = null;
let cachedE = null;

function pi() {
  if (!cachedPi) cachedPi = Decimal.acos(-1);
  return cachedPi;
}

function eulers() {
  if (!cachedE) cachedE = new Decimal(1).exp();
  return cachedE;
}

function isInteger(value) {
  return typeof value === "bigint";
}

function toDecimal(value) {
  return isInteger(value) ? new Decimal(value.toString()) : value;
}

const functions = {
  sin: (x, deg) => (deg ? toRadians(x) : x).sin(),
  cos: (x, deg) => (deg ? toRadians(x) : x).cos(),
  tan: (x, deg) => (deg ? toRadians(x) : x).tan(),
  asin: (x, deg) => (deg ? toDegrees(x.asin()) : x.asin()),
  acos: (x, deg) => (deg ? toDegrees(x.acos()) : x.acos()),
  atan: (x, deg) => (deg ? toDegrees(x.atan()) : x.atan()),
  ln: (x) => x.ln(),
  log: (x) => x.log(10),
  sqrt: (x) => x.sqrt(),
  cbrt: (x) => x.cbrt()
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animationClasses = ["flash", "shake", "appear", "remove"];

let historyData = loadHistory();
let toastTimer = null;

function toRadians(value) {
  return value.times(pi()).div(180);
}

function toDegrees(value) {
  return value.times(180).div(pi());
}

function normalize(expression) {
  return expression
    .replace(/,/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/⁻¹/g, "^(-1)")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/%/g, "*0.01")
    .replace(/√/g, "sqrt")
    .replace(/∛/g, "cbrt")
    .replace(/π/g, "pi");
}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (char === " ") {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let number = "";
      while (i < input.length && /[0-9.]/.test(input[i])) {
        number += input[i];
        i += 1;
      }
      const value = /^[0-9]+$/.test(number) ? BigInt(number) : new Decimal(number);
      tokens.push({ type: "number", value });
      continue;
    }
    if (/[a-z]/i.test(char)) {
      let name = "";
      while (i < input.length && /[a-z]/i.test(input[i])) {
        name += input[i];
        i += 1;
      }
      if (name === "pi") tokens.push({ type: "number", value: pi() });
      else if (name === "e") tokens.push({ type: "number", value: eulers() });
      else tokens.push({ type: "function", value: name });
      continue;
    }
    if ("+-*/^".includes(char)) {
      tokens.push({ type: "operator", value: char });
      i += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "leftParen" });
      i += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rightParen" });
      i += 1;
      continue;
    }
    if (char === "!") {
      tokens.push({ type: "postfix", value: "!" });
      i += 1;
      continue;
    }
    throw new Error("Invalid character");
  }
  return tokens;
}

function toReversePolish(tokens) {
  const output = [];
  const operators = [];
  let previous = null;

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
    } else if (token.type === "function") {
      operators.push(token);
    } else if (token.type === "operator") {
      const unary =
        previous === null ||
        previous.type === "operator" ||
        previous.type === "leftParen";
      if (unary && token.value === "+") {
        previous = token;
        continue;
      }
      const value = unary && token.value === "-" ? "u" : token.value;
      while (operators.length) {
        const top = operators[operators.length - 1];
        if (top.type === "function") {
          output.push(operators.pop());
          continue;
        }
        if (top.type !== "operator") break;
        const higher = precedence[top.value] > precedence[value];
        const equal =
          precedence[top.value] === precedence[value] && !rightAssociative[value];
        if (higher || equal) output.push(operators.pop());
        else break;
      }
      operators.push({ type: "operator", value });
    } else if (token.type === "postfix") {
      output.push(token);
    } else if (token.type === "leftParen") {
      operators.push(token);
    } else if (token.type === "rightParen") {
      while (operators.length && operators[operators.length - 1].type !== "leftParen") {
        output.push(operators.pop());
      }
      if (!operators.length) throw new Error("Mismatched parentheses");
      operators.pop();
      if (operators.length && operators[operators.length - 1].type === "function") {
        output.push(operators.pop());
      }
    }
    previous = token;
  }

  while (operators.length) {
    const top = operators.pop();
    if (top.type === "leftParen") throw new Error("Mismatched parentheses");
    output.push(top);
  }
  return output;
}

function factorial(value) {
  if (!isInteger(value) && !value.isInteger()) throw new Error("Invalid factorial");
  const n = isInteger(value) ? value : BigInt(value.toFixed());
  if (n < 0n) throw new Error("Invalid factorial");
  if (n > BigInt(FACTORIAL_LIMIT)) throw new Error("Out of range");
  let result = 1n;
  for (let i = 2n; i <= n; i += 1n) result *= i;
  return result;
}

function evaluateRpn(output, degrees) {
  const stack = [];
  for (const token of output) {
    if (token.type === "number") {
      stack.push(token.value);
    } else if (token.type === "operator") {
      if (token.value === "u") {
        const operand = stack.pop();
        stack.push(isInteger(operand) ? -operand : operand.neg());
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("Invalid expression");
      stack.push(applyOperator(token.value, a, b));
    } else if (token.type === "function") {
      const handler = functions[token.value];
      if (!handler) throw new Error("Unknown function");
      const x = stack.pop();
      if (x === undefined) throw new Error("Invalid expression");
      stack.push(handler(toDecimal(x), degrees));
    } else if (token.type === "postfix") {
      const x = stack.pop();
      if (x === undefined) throw new Error("Invalid expression");
      stack.push(factorial(x));
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
}

function integerPower(base, exponent) {
  if (base === 0n || base === 1n || base === -1n) return base ** exponent;
  const digits = base.toString().replace("-", "").length * Number(exponent);
  if (digits > MAX_POWER_DIGITS) throw new Error("Out of range");
  return base ** exponent;
}

function applyOperator(operator, a, b) {
  if (isInteger(a) && isInteger(b)) {
    switch (operator) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        if (b === 0n) throw new Error("Division by zero");
        return a % b === 0n ? a / b : toDecimal(a).div(toDecimal(b));
      case "^":
        if (b >= 0n) return integerPower(a, b);
        break;
      default:
        throw new Error("Unknown operator");
    }
  }

  const x = toDecimal(a);
  const y = toDecimal(b);
  switch (operator) {
    case "+":
      return x.plus(y);
    case "-":
      return x.minus(y);
    case "*":
      return x.times(y);
    case "/":
      if (y.isZero()) throw new Error("Division by zero");
      return x.div(y);
    case "^":
      return x.pow(y);
    default:
      throw new Error("Unknown operator");
  }
}

function evaluate(expression) {
  if (!expression.trim()) throw new Error("Empty expression");
  const result = evaluateRpn(toReversePolish(tokenize(normalize(expression))), state.degrees);
  if (!isInteger(result) && (result.isNaN() || !result.isFinite())) throw new Error("Out of range");
  return result;
}

function groupDigits(text) {
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [integer, decimal] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = decimal ? `${grouped}.${decimal}` : grouped;
  return negative ? `-${body}` : body;
}

function formatNumber(value) {
  if (isInteger(value)) return value === 0n ? "0" : groupDigits(value.toString());
  if (value.isZero() || value.abs().lt(ZERO_SNAP)) return "0";
  if (value.isInteger()) return groupDigits(value.toFixed());
  const display = value.toSignificantDigits(DISPLAY_DIGITS);
  const magnitude = display.abs();
  if (magnitude.gte("1e21") || magnitude.lt("1e-9")) {
    return display.toExponential().replace(/e\+?/, "e");
  }
  return groupDigits(display.toFixed());
}

function hasOperation(expression) {
  return /[+\-×÷^!²³⁻√∛%(]/.test(expression) || /(sin|cos|tan|ln|log)/.test(expression);
}

let previewCache = { key: "", value: null };

function preview(expression) {
  if (!expression || !hasOperation(expression)) return null;
  const key = `${state.degrees}|${expression}`;
  if (previewCache.key === key) return previewCache.value;
  let value;
  try {
    value = formatNumber(evaluate(expression));
  } catch (error) {
    value = null;
  }
  previewCache = { key, value };
  return value;
}

let previewFrame = null;

function setSecondary(text) {
  secondaryEl.textContent = text;
  secondaryEl.classList.toggle("visible", text !== "");
  secondaryEl.scrollLeft = secondaryEl.scrollWidth;
}

function updateOverflow() {
  const maxLeft = primaryEl.scrollWidth - primaryEl.clientWidth;
  const overflowing = maxLeft > 1;
  const left = primaryEl.scrollLeft;
  primaryWrap.classList.toggle("overflow-left", overflowing && left > 1);
  primaryWrap.classList.toggle("overflow-right", overflowing && left < maxLeft - 1);
  displayMeta.classList.toggle("visible", overflowing);
  const text = primaryEl.textContent;
  const digits = text === "0" ? 0 : (text.match(/\d/g) || []).length;
  if (overflowing && digits > 0) {
    metaCount.textContent = `${digits.toLocaleString("en-US")} ${digits === 1 ? "digit" : "digits"}`;
    metaCount.hidden = false;
  } else {
    metaCount.hidden = true;
  }
}

function scrollPrimary(toStart) {
  primaryEl.scrollLeft = toStart ? 0 : primaryEl.scrollWidth;
  updateOverflow();
}

function refresh() {
  primaryEl.classList.remove("error");
  primaryEl.textContent = state.expression === "" ? "0" : state.expression;
  scrollPrimary(state.evaluated);
  if (previewFrame) {
    cancelAnimationFrame(previewFrame);
    previewFrame = null;
  }
  if (state.evaluated) {
    setSecondary(`${state.history} =`);
    return;
  }
  previewFrame = requestAnimationFrame(() => {
    previewFrame = null;
    const result = preview(state.expression);
    setSecondary(result === null ? "" : `= ${result}`);
  });
}

function animate(name) {
  if (prefersReducedMotion) return;
  primaryEl.classList.remove(...animationClasses);
  void primaryEl.offsetWidth;
  primaryEl.classList.add(name);
}

function pressFeedback(button) {
  if (!button || prefersReducedMotion) return;
  button.classList.add("pressed");
  setTimeout(() => button.classList.remove("pressed"), 130);
}

function findKey(selector) {
  return keysContainer.querySelector(selector);
}

function insertValue(value, type) {
  if (state.evaluated) {
    if (type === "op" || type === "postfix") state.evaluated = false;
    else {
      state.expression = "";
      state.evaluated = false;
    }
  }
  state.expression += value;
  refresh();
  animate("appear");
}

function deleteLast() {
  if (state.evaluated) {
    state.evaluated = false;
    refresh();
    return;
  }
  if (state.expression === "") return;
  let removed = false;
  for (const token of multiCharTokens) {
    if (state.expression.endsWith(token)) {
      state.expression = state.expression.slice(0, -token.length);
      removed = true;
      break;
    }
  }
  if (!removed) state.expression = state.expression.slice(0, -1);
  refresh();
  animate("remove");
}

function clearAll() {
  state.expression = "";
  state.history = "";
  state.evaluated = false;
  refresh();
}

function toggleSign() {
  state.evaluated = false;
  const match = state.expression.match(/(\d*\.?\d+)$/);
  if (!match) {
    state.expression += "−";
    refresh();
    return;
  }
  const start = match.index;
  const before = state.expression[start - 1];
  if (before === "−" && (start - 1 === 0 || "+-×÷*/^(".includes(state.expression[start - 2]))) {
    state.expression = state.expression.slice(0, start - 1) + state.expression.slice(start);
  } else {
    state.expression = `${state.expression.slice(0, start)}−${state.expression.slice(start)}`;
  }
  refresh();
}

function equals() {
  if (!state.expression) return;
  try {
    const result = evaluate(state.expression);
    const expression = state.expression;
    const formatted = formatNumber(result);
    state.history = expression;
    state.expression = formatted;
    state.evaluated = true;
    refresh();
    animate("flash");
    addToHistory(expression, formatted);
  } catch (error) {
    primaryEl.textContent = "Error";
    primaryEl.classList.add("error");
    secondaryEl.textContent = "";
    secondaryEl.classList.remove("visible");
    state.expression = "";
    state.history = "";
    state.evaluated = false;
    updateOverflow();
    animate("shake");
  }
}

function toggleSecond() {
  state.second = !state.second;
  secondKey.classList.toggle("active", state.second);
  altButtons.forEach((button) => {
    button.textContent = state.second ? button.dataset.label2 : button.dataset.label1;
    button.dataset.value = state.second ? button.dataset.value2 : button.dataset.value1;
  });
}

function toggleAngle() {
  state.degrees = !state.degrees;
  angleKey.textContent = state.degrees ? "DEG" : "RAD";
  if (state.evaluated) {
    state.evaluated = false;
    state.expression = state.history;
  }
  refresh();
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  const apply = () => {
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };

  themeToggle.classList.remove("spin");
  void themeToggle.offsetWidth;
  themeToggle.classList.add("spin");

  if (!document.startViewTransition || prefersReducedMotion) {
    apply();
    return;
  }

  const rect = themeToggle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const transition = document.startViewTransition(apply);
  transition.ready.then(() => {
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.animate(
      {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
      },
      {
        duration: 520,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)"
      }
    );
  });
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem("history") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem("history", JSON.stringify(historyData));
}

function addToHistory(expression, result) {
  historyData.push({ expression, result });
  if (historyData.length > 40) historyData = historyData.slice(-40);
  saveHistory();
  historyPanel.classList.toggle("has-items", historyData.length > 0);
  if (historyPanel.classList.contains("open")) renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  historyPanel.classList.toggle("has-items", historyData.length > 0);
  [...historyData].reverse().forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "history-item";
    item.tabIndex = 0;
    if (!prefersReducedMotion) item.style.animationDelay = `${index * 0.03}s`;

    const expr = document.createElement("span");
    expr.className = "history-expr";
    expr.textContent = entry.expression;

    const result = document.createElement("span");
    result.className = "history-result";
    result.textContent = entry.result;

    item.append(expr, result);
    item.addEventListener("click", () => reuseHistory(entry.result));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reuseHistory(entry.result);
      }
    });
    historyList.appendChild(item);
  });
}

function reuseHistory(result) {
  state.expression = result;
  state.history = "";
  state.evaluated = true;
  refresh();
  closeHistory();
}

function openHistory() {
  renderHistory();
  historyPanel.classList.add("open");
  scrim.classList.add("open");
}

function closeHistory() {
  historyPanel.classList.remove("open");
  scrim.classList.remove("open");
}

function clearHistory() {
  historyData = [];
  saveHistory();
  renderHistory();
}

function copyResult() {
  const text = primaryEl.textContent;
  if (!text || text === "Error" || text === "0") return;
  const value = text.replace(/,/g, "");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(() => showToast("Copied")).catch(() => {});
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
}

function handleAction(action) {
  switch (action) {
    case "clear":
      clearAll();
      break;
    case "delete":
      deleteLast();
      break;
    case "sign":
      toggleSign();
      break;
    case "equals":
      equals();
      break;
    case "second":
      toggleSecond();
      break;
    case "angle":
      toggleAngle();
      break;
    default:
      break;
  }
}

themeToggle.addEventListener("click", toggleTheme);
historyToggle.addEventListener("click", openHistory);
historyClear.addEventListener("click", clearHistory);
scrim.addEventListener("click", closeHistory);
let dragState = null;

function onPrimaryPointerDown(event) {
  if (event.button) return;
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startScroll: primaryEl.scrollLeft,
    moved: false
  };
  try {
    primaryEl.setPointerCapture(event.pointerId);
  } catch (error) {}
}

function onPrimaryPointerMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const dx = event.clientX - dragState.startX;
  if (!dragState.moved && Math.abs(dx) > 4) {
    dragState.moved = true;
    primaryEl.classList.add("grabbing");
  }
  if (dragState.moved) primaryEl.scrollLeft = dragState.startScroll - dx;
}

function onPrimaryPointerUp(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const dragged = dragState.moved;
  try {
    primaryEl.releasePointerCapture(dragState.pointerId);
  } catch (error) {}
  dragState = null;
  primaryEl.classList.remove("grabbing");
  if (!dragged) copyResult();
}

function jumpToEnd() {
  const behavior = prefersReducedMotion ? "auto" : "smooth";
  const atStart = primaryEl.scrollLeft <= 1;
  primaryEl.scrollTo({ left: atStart ? primaryEl.scrollWidth : 0, behavior });
}

primaryEl.addEventListener("pointerdown", onPrimaryPointerDown);
primaryEl.addEventListener("pointermove", onPrimaryPointerMove);
primaryEl.addEventListener("pointerup", onPrimaryPointerUp);
primaryEl.addEventListener("pointercancel", onPrimaryPointerUp);
primaryEl.addEventListener("scroll", updateOverflow, { passive: true });

primaryEl.addEventListener("wheel", (event) => {
  if (primaryEl.scrollWidth - primaryEl.clientWidth <= 1) return;
  event.preventDefault();
  primaryEl.scrollLeft += event.deltaY + event.deltaX;
}, { passive: false });

primaryEl.addEventListener("keydown", (event) => {
  const behavior = prefersReducedMotion ? "auto" : "smooth";
  if (event.key === "Home") {
    event.preventDefault();
    primaryEl.scrollTo({ left: 0, behavior });
  } else if (event.key === "End") {
    event.preventDefault();
    primaryEl.scrollTo({ left: primaryEl.scrollWidth, behavior });
  } else if (event.key === "ArrowLeft") {
    primaryEl.scrollLeft -= 48;
  } else if (event.key === "ArrowRight") {
    primaryEl.scrollLeft += 48;
  }
});

metaCount.addEventListener("click", jumpToEnd);
window.addEventListener("resize", updateOverflow);

keysContainer.addEventListener("click", (event) => {
  const key = event.target.closest(".key");
  if (!key) return;
  if (key.dataset.action) handleAction(key.dataset.action);
  else insertValue(key.dataset.value, key.dataset.type);
});

const keyboardInserts = {
  "+": { value: "+", type: "op" },
  "-": { value: "−", type: "op" },
  "*": { value: "×", type: "op" },
  "/": { value: "÷", type: "op" },
  "^": { value: "^", type: "op" },
  "(": { value: "(", type: "op" },
  ")": { value: ")", type: "op" },
  "!": { value: "!", type: "postfix" },
  "%": { value: "%", type: "postfix" }
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && historyPanel.classList.contains("open")) {
    closeHistory();
    return;
  }

  let button = null;
  if (/^[0-9.]$/.test(event.key)) {
    insertValue(event.key, "digit");
    button = findKey(`[data-value="${event.key}"]`);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    handleAction("equals");
    button = findKey('[data-action="equals"]');
  } else if (event.key === "Backspace") {
    event.preventDefault();
    deleteLast();
    button = findKey('[data-action="delete"]');
  } else if (event.key === "Escape") {
    clearAll();
    button = findKey('[data-action="clear"]');
  } else {
    const insert = keyboardInserts[event.key];
    if (insert) {
      event.preventDefault();
      insertValue(insert.value, insert.type);
      button = findKey(`[data-value="${insert.value}"]`);
    }
  }
  pressFeedback(button);
});

function animateEntrance() {
  if (prefersReducedMotion) return;
  const keys = [...keysContainer.querySelectorAll(".key")];
  keys.forEach((key, index) => {
    key.style.animationDelay = `${0.18 + index * 0.016}s`;
    key.classList.add("enter");
    key.addEventListener(
      "animationend",
      () => {
        key.classList.remove("enter");
        key.style.animationDelay = "";
      },
      { once: true }
    );
  });
}

renderHistory();
refresh();
animateEntrance();
