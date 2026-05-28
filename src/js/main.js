const primaryEl = document.getElementById("primary");
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

const functions = {
  sin: (x, deg) => Math.sin(deg ? toRadians(x) : x),
  cos: (x, deg) => Math.cos(deg ? toRadians(x) : x),
  tan: (x, deg) => Math.tan(deg ? toRadians(x) : x),
  asin: (x, deg) => (deg ? toDegrees(Math.asin(x)) : Math.asin(x)),
  acos: (x, deg) => (deg ? toDegrees(Math.acos(x)) : Math.acos(x)),
  atan: (x, deg) => (deg ? toDegrees(Math.atan(x)) : Math.atan(x)),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x)
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animationClasses = ["flash", "shake", "appear", "remove"];

let historyData = loadHistory();
let toastTimer = null;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function normalize(expression) {
  return expression
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
      tokens.push({ type: "number", value: parseFloat(number) });
      continue;
    }
    if (/[a-z]/i.test(char)) {
      let name = "";
      while (i < input.length && /[a-z]/i.test(input[i])) {
        name += input[i];
        i += 1;
      }
      if (name === "pi") tokens.push({ type: "number", value: Math.PI });
      else if (name === "e") tokens.push({ type: "number", value: Math.E });
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
  if (value < 0 || !Number.isInteger(value)) throw new Error("Invalid factorial");
  let result = 1;
  for (let i = 2; i <= value; i += 1) result *= i;
  return result;
}

function evaluateRpn(output, degrees) {
  const stack = [];
  for (const token of output) {
    if (token.type === "number") {
      stack.push(token.value);
    } else if (token.type === "operator") {
      if (token.value === "u") {
        stack.push(-stack.pop());
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
      stack.push(handler(x, degrees));
    } else if (token.type === "postfix") {
      const x = stack.pop();
      if (x === undefined) throw new Error("Invalid expression");
      stack.push(factorial(x));
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
}

function applyOperator(operator, a, b) {
  switch (operator) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new Error("Division by zero");
      return a / b;
    case "^":
      return Math.pow(a, b);
    default:
      throw new Error("Unknown operator");
  }
}

function evaluate(expression) {
  if (!expression.trim()) throw new Error("Empty expression");
  const result = evaluateRpn(toReversePolish(tokenize(normalize(expression))), state.degrees);
  if (!Number.isFinite(result)) throw new Error("Out of range");
  return result;
}

function formatNumber(value) {
  let rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  if (Object.is(rounded, -0)) rounded = 0;
  const magnitude = Math.abs(rounded);
  if (magnitude !== 0 && (magnitude >= 1e12 || magnitude < 1e-9)) {
    return rounded.toExponential(6).replace(/\.?0+e/, "e");
  }
  const [integer, decimal] = String(rounded).split(".");
  const formattedInteger = Number(integer).toLocaleString("en-US");
  return decimal ? `${formattedInteger}.${decimal}` : formattedInteger;
}

function hasOperation(expression) {
  return /[+\-×÷^!²³⁻√∛%(]/.test(expression) || /(sin|cos|tan|ln|log)/.test(expression);
}

function preview(expression) {
  if (!expression || !hasOperation(expression)) return null;
  try {
    return formatNumber(evaluate(expression));
  } catch (error) {
    return null;
  }
}

function refresh() {
  primaryEl.classList.remove("error");
  primaryEl.textContent = state.expression === "" ? "0" : state.expression;
  let secondaryText = "";
  if (state.evaluated) {
    secondaryText = `${state.history} =`;
  } else {
    const result = preview(state.expression);
    secondaryText = result === null ? "" : `= ${result}`;
  }
  secondaryEl.textContent = secondaryText;
  secondaryEl.classList.toggle("visible", secondaryText !== "");
  scrollToEnd();
}

function scrollToEnd() {
  primaryEl.scrollLeft = primaryEl.scrollWidth;
  secondaryEl.scrollLeft = secondaryEl.scrollWidth;
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
  renderHistory();
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
primaryEl.addEventListener("click", copyResult);

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
