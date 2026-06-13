export interface AppScrollPosition {
  plannerTop: number;
  plannerLeft: number;
  sidebarTop: number;
}

export function captureAppScroll(root: HTMLElement): AppScrollPosition {
  const planner = root.querySelector<HTMLElement>(".planner");
  const sidebar = root.querySelector<HTMLElement>(".sidebar");

  return {
    plannerTop: planner?.scrollTop ?? 0,
    plannerLeft: planner?.scrollLeft ?? 0,
    sidebarTop: sidebar?.scrollTop ?? 0,
  };
}

export function restoreAppScroll(
  root: HTMLElement,
  position: AppScrollPosition,
): void {
  const planner = root.querySelector<HTMLElement>(".planner");
  const sidebar = root.querySelector<HTMLElement>(".sidebar");

  if (planner) {
    planner.scrollTop = position.plannerTop;
    planner.scrollLeft = position.plannerLeft;
  }

  if (sidebar) {
    sidebar.scrollTop = position.sidebarTop;
  }
}
