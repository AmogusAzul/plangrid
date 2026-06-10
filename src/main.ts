import "./styles.css";
import { createBlankPlan } from "./state/planFactory";
import { loadPlan, savePlan, STORAGE_KEY } from "./state/planStorage";
import { renderApp } from "./ui/renderApp";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("PlanGrid could not find the application root.");
}

const appRoot = root;
let plan = loadPlan();

function render(): void {
  renderApp(appRoot, plan, {
    updatePlan(update) {
      plan = savePlan(update(plan));
      render();
    },
    resetPlan() {
      localStorage.removeItem(STORAGE_KEY);
      plan = savePlan(createBlankPlan());
      render();
    },
  });
}

render();
