import { App, Menu, TFile } from "obsidian";
import { TaskCalendarView } from "./view";
import { ViewMode } from "./settings";
import { ColorRulesModal } from "./colorRulesModal";
import { FilterModal } from "./filterModal";
import { QueryPathModal } from "./queryPathModal";
import { Task, isMultiDayTask } from "./taskParser";

export function renderCalendar(container: HTMLElement, view: TaskCalendarView) {
  renderToolbar(container, view);
  renderHeader(container, view);

  if (view.viewMode === "month") {
    renderWeekdayHeaders(container);
  }

  switch (view.viewMode) {
    case "month":
      renderMonthView(container, view);
      break;
    case "week":
      renderWeekView(container, view);
      break;
  }
}

// ═══════════════════════════════════════════════════════════
//  Toolbar
// ═══════════════════════════════════════════════════════════

function renderToolbar(container: HTMLElement, view: TaskCalendarView) {
  const toolbar = container.createDiv({ cls: "calendar-toolbar" });

  const modeGroup = toolbar.createDiv({ cls: "calendar-mode-group" });
  const modes: { key: ViewMode; label: string }[] = [
    { key: "month", label: "\u6708" },
    { key: "week", label: "\u5468" },
  ];
  for (const m of modes) {
    const btn = modeGroup.createEl("button", {
      cls: `calendar-mode-btn${view.viewMode === m.key ? " active" : ""}`,
      text: m.label,
    });
    btn.addEventListener("click", () => {
      view.viewMode = m.key;
      view.render();
    });
  }

  const queryBtn = toolbar.createEl("button", {
    cls: "calendar-query-btn",
    text: "\u626b\u63cf\u8def\u5f84",
  });
  queryBtn.addEventListener("click", () => {
    const modal = new QueryPathModal(view.app, view.plugin, () => {
      view.loadTasks().then(() => view.render());
    });
    modal.open();
  });

  const colorBtn = toolbar.createEl("button", {
    cls: "calendar-color-rules-btn",
    text: "\u5206\u7c7b\u914d\u8272",
  });
  colorBtn.addEventListener("click", () => {
    const modal = new ColorRulesModal(view.app, view.plugin);
    modal.onClose = () => view.render();
    modal.open();
  });

  const filterBtn = toolbar.createEl("button", {
    cls: `calendar-filter-btn${view.hasActiveFilters ? " has-filters" : ""}`,
    text: "\u7b5b\u9009",
  });
  filterBtn.addEventListener("click", () => {
    const modal = new FilterModal(view.app, view.plugin);
    modal.onClose = () => view.render();
    modal.open();
  });
}

// ═══════════════════════════════════════════════════════════
//  Header
// ═══════════════════════════════════════════════════════════

function renderHeader(container: HTMLElement, view: TaskCalendarView) {
  const header = container.createDiv({ cls: "calendar-header" });

  const prevBtn = header.createEl("button", { cls: "calendar-nav-btn", text: "\u2039" });
  prevBtn.addEventListener("click", () => {
    navigate(view, -1);
    view.render();
  });

  const title = header.createEl("span", { cls: "calendar-title" });
  title.setText(headerTitle(view));

  const nextBtn = header.createEl("button", { cls: "calendar-nav-btn", text: "\u203a" });
  nextBtn.addEventListener("click", () => {
    navigate(view, 1);
    view.render();
  });

  const todayBtn = header.createEl("button", { cls: "calendar-today-btn", text: "\u4eca\u5929" });
  todayBtn.addEventListener("click", () => {
    view.currentDate = new Date();
    view.render();
  });
}

function navigate(view: TaskCalendarView, direction: number) {
  switch (view.viewMode) {
    case "month":
      view.currentDate.setMonth(view.currentDate.getMonth() + direction);
      break;
    case "week":
      view.currentDate.setDate(view.currentDate.getDate() + direction * 7);
      break;
  }
}

function headerTitle(view: TaskCalendarView): string {
  const y = view.currentDate.getFullYear();
  const m = view.currentDate.getMonth();
  switch (view.viewMode) {
    case "month":
      return `${y}\u5e74${m + 1}\u6708`;
    case "week": {
      const mon = getWeekMonday(view.currentDate);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      const fmt = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`;
      return `${y}\u5e74  ${fmt(mon)} \u2013 ${fmt(sun)}`;
    }
  }
  return "";
}

// ═══════════════════════════════════════════════════════════
//  Weekday Headers (Month view only)
// ═══════════════════════════════════════════════════════════

function renderWeekdayHeaders(container: HTMLElement) {
  const row = container.createDiv({ cls: "calendar-weekdays" });
  for (const d of ["\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d", "\u65e5"]) {
    row.createDiv({ cls: "calendar-weekday", text: d });
  }
}

// ═══════════════════════════════════════════════════════════
//  Month View
// ═══════════════════════════════════════════════════════════

function renderMonthView(container: HTMLElement, view: TaskCalendarView) {
  const currentYear = view.currentDate.getFullYear();
  const currentMonth = view.currentDate.getMonth();
  const todayStr = formatDateStr(new Date());

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const jsWeekday = firstDayOfMonth.getDay();
  const startOffset = (jsWeekday + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const totalCells = startOffset + daysInMonth;
  const rows = Math.max(5, Math.ceil(totalCells / 7));
  const totalSlots = rows * 7;

  const allDays: DayInfo[] = [];

  if (startOffset > 0) {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    for (let i = 0; i < startOffset; i++) {
      const day = prevMonthDays - startOffset + i + 1;
      allDays.push({
        dateStr: `${prevYear}-${pad(prevMonth + 1)}-${pad(day)}`,
        dayNumber: day,
        isOtherMonth: true,
        isToday: false,
      });
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;
    allDays.push({
      dateStr,
      dayNumber: day,
      isOtherMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  const usedCells = startOffset + daysInMonth;
  if (usedCells < totalSlots) {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let day = 1; day <= totalSlots - usedCells; day++) {
      allDays.push({
        dateStr: `${nextYear}-${pad(nextMonth + 1)}-${pad(day)}`,
        dayNumber: day,
        isOtherMonth: true,
        isToday: false,
      });
    }
  }

  const filteredTasks = view.allTasks.filter((t) => !isTaskFiltered(view, t));

  const weeks: DayInfo[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const grid = container.createDiv({ cls: "calendar-grid-month" });

  for (const week of weeks) {
    const weekRow = grid.createDiv({ cls: "calendar-week-row" });
    const weekStart = week[0].dateStr;
    const weekEnd = week[6].dateStr;

    // ── 1. Date header row ────────────────────────────
    const dateRow = weekRow.createDiv({ cls: "calendar-week-date-row" });
    for (const day of week) {
      const dateCell = dateRow.createDiv({
        cls: `calendar-week-date-cell${day.isOtherMonth ? " other-month" : ""}${day.isToday ? " today" : ""}`,
      });
      dateCell.setText(String(day.dayNumber));
      setupContextMenu(dateCell, view, day.dateStr);
    }

    // ── 2. Multi-day bars overlay ───────────────────
    const barsOverlay = weekRow.createDiv({ cls: "calendar-week-bars-overlay" });

    const multiTasks = filteredTasks.filter((t) => {
      if (!isMultiDayTask(t)) return false;
      return t.startDate! <= weekEnd && t.dueDate! >= weekStart;
    });

    // Sort within each group by span (longest first)
    const incompleteMulti = multiTasks
      .filter((t) => !t.completed)
      .sort((a, b) => daySpan(b) - daySpan(a));
    const completedMulti = multiTasks
      .filter((t) => t.completed)
      .sort((a, b) => daySpan(b) - daySpan(a));

    // Separate lane pools: incomplete get top lanes, completed get bottom lanes
    const incLanes: Task[][] = [];
    const compLanes: Task[][] = [];

    for (const task of incompleteMulti) {
      let placed = false;
      for (const lane of incLanes) {
        if (!lane.some((lt) => rangesOverlap(lt, task))) {
          lane.push(task);
          placed = true;
          break;
        }
      }
      if (!placed && incLanes.length < 4) {
        incLanes.push([task]);
      }
    }

    for (const task of completedMulti) {
      let placed = false;
      for (const lane of compLanes) {
        if (!lane.some((lt) => rangesOverlap(lt, task))) {
          lane.push(task);
          placed = true;
          break;
        }
      }
      if (!placed && compLanes.length < 4) {
        compLanes.push([task]);
      }
    }

    const lanes = [...incLanes, ...compLanes];

    const overlayHeight = Math.max(0, lanes.length * 28 + 4);
    barsOverlay.style.height = `${overlayHeight}px`;

    for (let li = 0; li < lanes.length; li++) {
      for (const task of lanes[li]) {
        let startCol = week.findIndex((d) => d.dateStr === task.startDate);
        let endCol = week.findIndex((d) => d.dateStr === task.dueDate);
        if (startCol === -1) startCol = 0;
        if (endCol === -1) endCol = 6;
        const span = endCol - startCol + 1;
        const leftPct = (startCol / 7) * 100;
        const widthPct = (span / 7) * 100;

        const bar = barsOverlay.createDiv({ cls: "month-multi-bar" });
        if (task.completed) bar.addClass("completed");
        bar.style.left = `calc(${leftPct}% + 1px)`;
        bar.style.width = `calc(${widthPct}% - 2px)`;
        bar.style.top = `${li * 28 + 2}px`;

        const startsBeforeWeek = task.startDate! < weekStart;
        const endsAfterWeek = task.dueDate! > weekEnd;
        if (startsBeforeWeek) bar.addClass("continues-left");
        if (endsAfterWeek) bar.addClass("continues-right");

        const blockColor = view.getBlockTintColor(task);
        const barColors = view.getMatchingBarColors(task);
        if (blockColor) {
          bar.style.backgroundColor = blockColor;
          bar.addClass("block-tint");
        }
        if (barColors.length > 0) {
          const stripe = bar.createDiv({ cls: "month-bar-stripe" });
          stripe.style.backgroundColor = barColors[0];
        }

        bar.createSpan({ cls: "month-bar-text", text: task.description });

        // Click center to open file (ignore if on hit areas)
        bar.addEventListener("click", (e) => {
          if (bar.dataset.ignoreClick) return;
          if ((e.target as HTMLElement).closest(".month-bar-hit-left, .month-bar-hit-right")) return;
          view.openTaskFile(task);
        });

        // Resize hit areas
        const leftHit = bar.createDiv({ cls: "month-bar-hit-left" });
        leftHit.setAttr("title", "\u8c03\u6574\u8d77\u59cb\u65e5\u671f");
        setupBarResize(leftHit, task, "start", weekRow, view);

        const rightHit = bar.createDiv({ cls: "month-bar-hit-right" });
        rightHit.setAttr("title", "\u8c03\u6574\u7ec8\u6b62\u65e5\u671f");
        setupBarResize(rightHit, task, "due", weekRow, view);
      }
    }

    // ── 3. Day cells ────────
    for (const day of week) {
      const dayEl = weekRow.createDiv({
        cls: `calendar-day-cell${day.isOtherMonth ? " other-month" : ""}${day.isToday ? " today" : ""}`,
      });

      const dayTasks = filteredTasks.filter((t) => {
        if (!t.startDate) return false;
        const end = t.dueDate || t.startDate;
        return day.dateStr >= t.startDate && day.dateStr <= end;
      });

      // Count multi-day bars covering this day
      const multiBarCount = lanes.filter((lane) =>
        lane.some((t) => {
          const end = t.dueDate || t.startDate!;
          return day.dateStr >= t.startDate! && day.dateStr <= end;
        })
      ).length;

      const maxVisible = 5;
      const availableSlots = Math.max(0, maxVisible - multiBarCount);

      // Cards: overflow multi-day + single-day; completed tasks sink to bottom
      const overflowMulti = dayTasks.filter((t) =>
        isMultiDayTask(t) && !lanes.some((lane) => lane.includes(t))
      );
      const singleDayTasks = dayTasks.filter((t) => !isMultiDayTask(t));

      const allCards = [...overflowMulti, ...singleDayTasks];
      allCards.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));

      const visibleCards = allCards.slice(0, availableSlots);
      const hiddenCount = allCards.length - availableSlots;

      const tasksContainer = dayEl.createDiv({ cls: "calendar-notes" });
      for (const task of visibleCards) {
        tasksContainer.appendChild(
          createTaskCard(task, view, "month", weekRow)
        );
      }

      if (hiddenCount > 0) {
        const overflowBtn = dayEl.createDiv({ cls: "task-overflow-btn" });
        overflowBtn.setText(`\u8fd8\u6709 ${hiddenCount} \u4e2a`);
        overflowBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showTaskPopup(dayEl, day.dateStr, dayTasks, view);
        });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  Week View (display only, no resize)
// ═══════════════════════════════════════════════════════════

function renderWeekView(container: HTMLElement, view: TaskCalendarView) {
  const mon = getWeekMonday(view.currentDate);
  const grid = container.createDiv({ cls: "calendar-week-grid" });
  const todayStr = formatDateStr(new Date());
  const dayNames = ["\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d", "\u65e5"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    const dateStr = formatDateStr(d);
    const tasks = view.getTasksForDate(dateStr);
    const isToday = dateStr === todayStr;

    const col = grid.createDiv({ cls: `calendar-week-col${isToday ? " today" : ""}` });
    const colHeader = col.createDiv({ cls: "calendar-week-col-header" });
    colHeader.createSpan({ cls: "calendar-week-col-day", text: dayNames[i] });
    colHeader.createSpan({ cls: "calendar-week-col-date", text: `${d.getMonth() + 1}/${d.getDate()}` });

    setupContextMenu(col, view, dateStr);

    const tasksContainer = col.createDiv({ cls: "calendar-week-notes" });
    for (const task of tasks) {
      tasksContainer.appendChild(createTaskCard(task, view, "week"));
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  Task Card
// ═══════════════════════════════════════════════════════════

function createTaskCard(
  task: Task,
  view: TaskCalendarView,
  viewContext: "month" | "week",
  weekRow?: HTMLElement
): HTMLElement {
  const barColors = view.getMatchingBarColors(task);
  const blockColor = view.getBlockTintColor(task);

  const cls = ["calendar-note"];
  if (task.completed) cls.push("completed");
  if (isMultiDayTask(task)) cls.push("multi-day-task");

  const card = createDiv({ cls: cls.join(" ") });
  card.setAttr("data-task-id", task.id);

  if (blockColor) {
    card.style.backgroundColor = blockColor;
    card.addClass("block-tint");
  }

  if (barColors.length > 0) {
    const bars = card.createDiv({ cls: "calendar-note-bars" });
    for (const c of barColors) {
      bars.createDiv({ cls: "calendar-note-bar", attr: { style: `background-color:${c}` } });
    }
  }

  card.createSpan({ cls: "calendar-note-text", text: task.description });

  if (task.priority !== "none") {
    card.createSpan({
      cls: `task-priority task-priority-${task.priority}`,
      text: getPriorityEmoji(task.priority),
    });
  }

  if (viewContext !== "month" && task.tags.length > 0) {
    const tagsEl = card.createDiv({ cls: "task-tags" });
    for (const tag of task.tags.slice(0, 3)) {
      tagsEl.createSpan({ cls: "task-tag", text: `#${tag}` });
    }
  }

  if (viewContext !== "month" && isMultiDayTask(task)) {
    card.createDiv({ cls: "task-date-range", text: `${task.startDate} \u2192 ${task.dueDate}` });
  }

  card.addEventListener("click", () => {
    if (card.dataset.ignoreClick) return;
    view.openTaskFile(task);
  });

  // Month-view cards also get resize handles
  if (viewContext === "month" && weekRow) {
    const leftHit = card.createDiv({ cls: "card-hit-left" });
    leftHit.setAttr("title", "\u8c03\u6574\u8d77\u59cb\u65e5\u671f");
    setupBarResize(leftHit, task, "start", weekRow, view);

    const rightHit = card.createDiv({ cls: "card-hit-right" });
    rightHit.setAttr("title", "\u8c03\u6574\u7ec8\u6b62\u65e5\u671f");
    setupBarResize(rightHit, task, "due", weekRow, view);
  }

  return card;
}

function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case "high": return "\u2757\u2757\u2757";
    case "medium": return "\u2757\u2757";
    case "low": return "\u2757";
    default: return "";
  }
}

function createDiv(opts: { cls: string }): HTMLDivElement {
  const d = document.createElement("div");
  d.className = opts.cls;
  return d;
}

// ═══════════════════════════════════════════════════════════
//  Resize (prevent click after resize)
// ═══════════════════════════════════════════════════════════

function setupBarResize(
  hitEl: HTMLElement,
  task: Task,
  field: "start" | "due",
  weekRow: HTMLElement,
  view: TaskCalendarView
) {
  hitEl.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rowRect = weekRow.getBoundingClientRect();
    const dayWidth = rowRect.width / 7;
    const startX = e.clientX;
    const otherDate = field === "start" ? (task.dueDate || task.startDate!) : task.startDate!;
    const fixedDate = field === "start" ? task.startDate! : (task.dueDate || task.startDate!);

    // Mark parent to ignore next click
    const parentBar = hitEl.closest(".month-multi-bar, .calendar-note") as HTMLElement | null;
    if (parentBar) {
      parentBar.dataset.ignoreClick = "true";
    }

    const tooltip = document.body.createDiv({ cls: "resize-tooltip" });
    tooltip.setText(fixedDate);
    updateTooltipPos(tooltip, e.clientX, e.clientY);

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaDays = Math.round(deltaX / Math.max(dayWidth, 20));
      const newDate = addDays(fixedDate, deltaDays);
      tooltip.setText(newDate);
      updateTooltipPos(tooltip, e.clientX, e.clientY);
    };

    const onMouseUp = async (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaDays = Math.round(deltaX / Math.max(dayWidth, 20));
      const newDate = addDays(fixedDate, deltaDays);

      tooltip.remove();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // Clear ignore flag after a short delay so click is suppressed
      if (parentBar) {
        setTimeout(() => {
          delete parentBar.dataset.ignoreClick;
        }, 100);
      }

      if (newDate === fixedDate) return;

      if (field === "start") {
        if (newDate > otherDate) {
          await view.updateTaskDate(task, otherDate, otherDate);
        } else {
          await view.updateTaskDate(task, newDate, otherDate);
        }
      } else {
        if (newDate < otherDate) {
          await view.updateTaskDate(task, otherDate, otherDate);
        } else {
          await view.updateTaskDate(task, otherDate, newDate);
        }
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

function updateTooltipPos(el: HTMLElement, x: number, y: number) {
  el.style.left = `${x}px`;
  el.style.top = `${y - 36}px`;
}

// ═══════════════════════════════════════════════════════════
//  Context Menu
// ═══════════════════════════════════════════════════════════

function setupContextMenu(el: HTMLElement, view: TaskCalendarView, dateStr: string) {
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => {
      item
        .setTitle("\u65b0\u5efa\u4efb\u52a1")
        .setIcon("file-plus")
        .onClick(() => showCreateTaskModal(view.app, view, dateStr));
    });
    menu.showAtPosition({ x: e.clientX, y: e.clientY });
  });
}

// ═══════════════════════════════════════════════════════════
//  Create Task Modal
// ═══════════════════════════════════════════════════════════

function showCreateTaskModal(app: App, view: TaskCalendarView, dateStr: string) {
  const modalEl = document.body.createDiv({ cls: "calendar-create-modal" });
  modalEl.createEl("div", { cls: "calendar-create-title", text: `\u65b0\u5efa\u4efb\u52a1 \u2014 ${dateStr}` });

  const input = modalEl.createEl("input", {
    cls: "calendar-create-input",
    type: "text",
    attr: { placeholder: "\u4efb\u52a1\u63cf\u8ff0" },
  });
  input.focus();

  const footer = modalEl.createDiv({ cls: "calendar-create-footer" });

  const cancelBtn = footer.createEl("button", { text: "\u53d6\u6d88" });
  cancelBtn.addEventListener("click", () => modalEl.remove());

  const okBtn = footer.createEl("button", { cls: "mod-cta", text: "\u521b\u5efa" });
  okBtn.addEventListener("click", async () => {
    const title = input.value.trim();
    if (!title) return;
    modalEl.remove();
    await createTaskForDate(app, view, dateStr, title);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const title = input.value.trim();
      if (!title) return;
      modalEl.remove();
      createTaskForDate(app, view, dateStr, title);
    }
  });
}

async function createTaskForDate(app: App, view: TaskCalendarView, dateStr: string, description: string) {
  const paths = view.plugin.settings.queryPaths.filter((p) => p.enabled);
  const folder = paths.length > 0 ? paths[0].path : "";

  const fileName = `Tasks ${dateStr}`;
  let fullPath = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;

  let file = app.vault.getAbstractFileByPath(fullPath);

  if (!file) {
    const content = `- [ ] ${description} \ud83d\udeeb ${dateStr}\n`;
    await app.vault.create(fullPath, content);
  } else if (file instanceof TFile) {
    const existing = await app.vault.read(file);
    const newContent = existing + `\n- [ ] ${description} \ud83d\udeeb ${dateStr}`;
    await app.vault.modify(file, newContent);
  }

  await view.loadTasks();
  view.render();
}

// ═══════════════════════════════════════════════════════════
//  Task Popup
// ═══════════════════════════════════════════════════════════

function showTaskPopup(
  anchorEl: HTMLElement,
  dateStr: string,
  tasks: Task[],
  view: TaskCalendarView
) {
  document.querySelectorAll(".task-day-popup").forEach((el) => el.remove());

  const popup = document.body.createDiv({ cls: "task-day-popup" });

  const rect = anchorEl.getBoundingClientRect();
  let left = rect.right + 4;
  let top = rect.top;
  const popupWidth = 260;
  const popupHeight = Math.min(400, tasks.length * 44 + 60);

  if (left + popupWidth > window.innerWidth - 16) left = rect.left - popupWidth - 4;
  if (top + popupHeight > window.innerHeight - 16) top = window.innerHeight - popupHeight - 16;
  if (top < 16) top = 16;

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  const header = popup.createDiv({ cls: "task-popup-header" });
  header.setText(`${dateStr} \u2014 ${tasks.length} \u4e2a\u4efb\u52a1`);

  const list = popup.createDiv({ cls: "task-popup-list" });
  for (const task of tasks) {
    const item = list.createDiv({ cls: "task-popup-item" });

    const status = item.createDiv({ cls: "task-popup-status" });
    status.setText(task.completed ? "\u2611" : "\u2610");
    if (task.completed) status.addClass("completed");

    const info = item.createDiv({ cls: "task-popup-info" });
    info.createDiv({ cls: "task-popup-desc", text: task.description });

    const meta = info.createDiv({ cls: "task-popup-meta" });
    if (task.priority !== "none") {
      meta.createSpan({ cls: `task-popup-priority task-priority-${task.priority}`, text: getPriorityEmoji(task.priority) });
    }
    for (const tag of task.tags.slice(0, 3)) {
      meta.createSpan({ cls: "task-popup-tag", text: `#${tag}` });
    }
    if (isMultiDayTask(task)) {
      meta.createSpan({ cls: "task-popup-range", text: `${task.startDate}\u2192${task.dueDate}` });
    }

    item.addEventListener("click", () => {
      view.openTaskFile(task);
      popup.remove();
    });
  }

  const closeHandler = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
      document.removeEventListener("click", closeHandler);
    }
  };
  setTimeout(() => document.addEventListener("click", closeHandler), 0);
}

// ═══════════════════════════════════════════════════════════
//  Utilities
// ═══════════════════════════════════════════════════════════

function isTaskFiltered(view: TaskCalendarView, task: Task): boolean {
  const filters = view.plugin.settings.filterRules.filter(
    (r) => r.enabled && r.keyword.trim()
  );
  return filters.some((f) => {
    const kw = f.keyword.toLowerCase();
    switch (f.property) {
      case "tags":
        return task.tags.some((t) => t.toLowerCase().includes(kw));
      case "priority":
        return task.priority.toLowerCase().includes(kw);
      case "description":
        return task.description.toLowerCase().includes(kw);
    }
    return false;
  });
}

function rangesOverlap(a: Task, b: Task): boolean {
  const aStart = a.startDate!;
  const aEnd = a.dueDate || a.startDate!;
  const bStart = b.startDate!;
  const bEnd = b.dueDate || b.startDate!;
  return aStart <= bEnd && bStart <= aEnd;
}

function daySpan(task: Task): number {
  if (!task.startDate || !task.dueDate) return 1;
  const s = new Date(task.startDate);
  const e = new Date(task.dueDate);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface DayInfo {
  dateStr: string;
  dayNumber: number;
  isOtherMonth: boolean;
  isToday: boolean;
}
