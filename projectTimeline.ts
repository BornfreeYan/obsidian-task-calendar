import { Menu } from "obsidian";
import { TaskCalendarView, ProjectTimelineData } from "./view";
import { Project } from "./settings";
import { ProjectModal } from "./projectModal";
import { Task, isMultiDayTask } from "./taskParser";

const COL_WIDTH = 88;
const DAYS_PAST = 30;
const DAYS_FUTURE = 29;
const TOTAL_DAYS = DAYS_PAST + 1 + DAYS_FUTURE; // 60

export function renderProjectTimeline(
  container: HTMLElement,
  view: TaskCalendarView
) {
  const center = new Date(view.currentDate);
  const realTodayStr = formatDateStr(new Date());

  // Gather project data
  const data = view.getProjectsData();
  if (data.length === 0) {
    container.createDiv({
      cls: "project-timeline-empty",
      text: "\u6682\u65e0\u9879\u76ee\uff0c\u70b9\u51fb [+ \u9879\u76ee] \u65b0\u5efa",
    });
    return;
  }

  // Build 60-day date array centered on view.currentDate
  const dates = buildDateRange(center);

  // Sort: 100% projects sink to bottom
  data.sort((a, b) => {
    if (a.progress === 100 && b.progress !== 100) return 1;
    if (b.progress === 100 && a.progress !== 100) return -1;
    return 0;
  });

  // Main container
  const timelineContainer = container.createDiv({ cls: "project-timeline-container" });

  // ── Left panel: project names + progress ──────────
  const leftPanel = timelineContainer.createDiv({ cls: "project-left-panel" });

  const leftHeader = leftPanel.createDiv({ cls: "project-left-header" });
  leftHeader.createSpan({ text: "\u8fdb\u5ea6" });

  const leftList = leftPanel.createDiv({ cls: "project-left-list" });
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const row = leftList.createDiv({
      cls: `project-left-row${d.progress >= 100 ? " completed" : ""}`,
    });

    const pct = d.total > 0 ? Math.round((d.hit / d.total) * 100) : 0;

    row.createSpan({ cls: "project-left-name", text: d.project.name });

    const progBar = row.createEl("progress", { cls: "project-left-progress" });
    progBar.setAttr("value", String(d.hit));
    progBar.setAttr("max", String(d.total));

    row.createSpan({
      cls: "project-left-stat",
      text: d.total > 0 ? `${pct}% (${d.hit}/${d.total})` : "\u2014",
    });

    // Right-click: edit/delete
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showProjectContextMenu(view, d.project, e.clientX, e.clientY);
    });
  }

  // ── Right panel: timeline ─────────────────────────
  const rightPanel = timelineContainer.createDiv({ cls: "project-timeline-right" });

  const scrollArea = rightPanel.createDiv({ cls: "project-timeline-scroll" });

  const innerWidth = TOTAL_DAYS * COL_WIDTH;
  const inner = scrollArea.createDiv({ cls: "project-timeline-inner" });
  inner.style.width = `${innerWidth}px`;

  const headerRow = inner.createDiv({ cls: "project-timeline-header-row" });
  for (const d of dates) {
    const hdr = headerRow.createDiv({
      cls: `project-day-header${d === realTodayStr ? " today" : ""}`,
    });
    hdr.createSpan({ cls: "project-day-header-month", text: `${parseInt(d.slice(5, 7))}/` });
    hdr.createSpan({ cls: "project-day-header-day", text: d.slice(8) });
  }

  const rowsWrap = inner.createDiv({ cls: "project-timeline-rows" });
  for (const d of data) {
    const row = rowsWrap.createDiv({
      cls: `project-timeline-row${d.progress >= 100 ? " completed" : ""}`,
    });

    // Build multi-day task bars overlay
    renderMultiDayTaskBars(row, d.tasks, dates, view);

    // Per-day cells (for single-day tasks and drop targets)
    for (const dateStr of dates) {
      const cell = row.createDiv({
        cls: `project-day-cell${dateStr === realTodayStr ? " today" : ""}`,
      });

      // Drop target
      setupDrop(cell, view, dateStr);

      const tasks = d.tasksByDate.get(dateStr) || [];
      // Only render single-day tasks in cells; multi-day are rendered as bars
      for (const task of tasks) {
        if (!isMultiDayTask(task)) {
          cell.appendChild(createTimelineTask(task, view));
        }
      }
    }
  }

  // ── Scroll sync ────────────────────────────────────
  leftList.addEventListener("scroll", () => {
    scrollArea.scrollTop = leftList.scrollTop;
  });
  scrollArea.addEventListener("scroll", () => {
    leftList.scrollTop = scrollArea.scrollTop;
  });

  // Default scroll: center date visible, center-3 at left edge.
  const savedScroll = view._projectScroll;
  view._projectScroll = null;

  if (savedScroll) {
    requestAnimationFrame(() => {
      scrollArea.scrollLeft = savedScroll.left;
      scrollArea.scrollTop = savedScroll.top;
    });
  } else {
    const centerIndex = DAYS_PAST;
    const defaultStart = Math.max(0, centerIndex - 3);
    scrollArea.scrollLeft = defaultStart * COL_WIDTH;
  }
}

// ── Multi-day task bars ──────────────────────────────

function renderMultiDayTaskBars(
  row: HTMLElement,
  tasks: Task[],
  dates: string[],
  view: TaskCalendarView
) {
  const multiTasks = tasks.filter(isMultiDayTask);
  if (multiTasks.length === 0) return;

  const barContainer = row.createDiv({ cls: "project-multi-day-bars" });

  for (const task of multiTasks) {
    if (!task.startDate || !task.dueDate) continue;

    const startIndex = dates.indexOf(task.startDate);
    const endIndex = dates.indexOf(task.dueDate);

    if (startIndex === -1 || endIndex === -1) continue;

    const left = startIndex * COL_WIDTH;
    const width = (endIndex - startIndex + 1) * COL_WIDTH;

    const bar = barContainer.createDiv({ cls: "project-task-bar" });
    bar.style.left = `${left}px`;
    bar.style.width = `${width - 4}px`;
    bar.setAttr("title", `${task.description} (${task.startDate} \u2192 ${task.dueDate})`);

    const blockColor = view.getBlockTintColor(task);
    const barColors = view.getMatchingBarColors(task);

    if (blockColor) {
      bar.style.backgroundColor = blockColor;
    }

    if (barColors.length > 0) {
      const bars = bar.createDiv({ cls: "task-bar-stripe" });
      bars.style.backgroundColor = barColors[0];
    }

    bar.createSpan({ cls: "task-bar-text", text: task.description });

    // Click to open file
    bar.addEventListener("click", () => {
      view.openTaskFile(task);
    });

    // Drag to move
    bar.setAttr("draggable", "true");
    bar.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", JSON.stringify({
        type: "move",
        taskId: task.id,
        startDate: task.startDate,
        dueDate: task.dueDate,
      }));
      bar.addClass("dragging");
    });
    bar.addEventListener("dragend", () => {
      bar.removeClass("dragging");
    });

    // Resize handles
    const leftHandle = bar.createDiv({ cls: "task-bar-resize task-bar-resize-left" });
    leftHandle.setAttr("title", "Adjust start date");

    const rightHandle = bar.createDiv({ cls: "task-bar-resize task-bar-resize-right" });
    rightHandle.setAttr("title", "Adjust due date");

    // Simple resize by clicking handles (drag-based resize is complex, placeholder for now)
    leftHandle.addEventListener("click", (e) => {
      e.stopPropagation();
      // TODO: implement interactive date picker or drag resize
    });
    rightHandle.addEventListener("click", (e) => {
      e.stopPropagation();
      // TODO: implement interactive date picker or drag resize
    });
  }
}

// ── Timeline single-day task block ─────────────────

function createTimelineNote(task: Task, view: TaskCalendarView): HTMLElement {
  const blockColor = view.getBlockTintColor(task);
  const barColors = view.getMatchingBarColors(task);

  const el = document.createElement("div");
  el.className = "project-note";
  el.setAttr("draggable", "true");
  el.setAttr("data-task-id", task.id);

  if (blockColor) {
    el.style.backgroundColor = blockColor;
    el.addClass("block-tint");
  }

  if (barColors.length > 0) {
    const bars = el.createDiv({ cls: "calendar-note-bars" });
    for (const c of barColors) {
      bars.createDiv({ cls: "calendar-note-bar", attr: { style: `background-color:${c}` } });
    }
  }

  el.createSpan({ cls: "project-note-text", text: task.description });

  el.addEventListener("click", () => {
    view.openTaskFile(task);
  });

  el.addEventListener("dragstart", (e) => {
    e.dataTransfer?.setData("text/plain", JSON.stringify({
      type: "move",
      taskId: task.id,
      startDate: task.startDate,
      dueDate: task.dueDate,
    }));
    el.addClass("dragging");
  });

  el.addEventListener("dragend", () => {
    el.removeClass("dragging");
  });

  return el;
}

function createTimelineTask(task: Task, view: TaskCalendarView): HTMLElement {
  return createTimelineNote(task, view);
}

// ── Drop handling ────────────────────────────────────

function setupDrop(el: HTMLElement, view: TaskCalendarView, dateStr: string) {
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.addClass("drag-over");
  });

  el.addEventListener("dragleave", () => {
    el.removeClass("drag-over");
  });

  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    el.removeClass("drag-over");

    const scrollArea = el.closest(".project-timeline-scroll");
    if (scrollArea) {
      view._projectScroll = {
        left: (scrollArea as HTMLElement).scrollLeft,
        top: (scrollArea as HTMLElement).scrollTop,
      };
    }

    const dataStr = e.dataTransfer?.getData("text/plain");
    if (!dataStr) return;

    let data: { type: string; taskId: string; startDate: string; dueDate: string };
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (data.type !== "move") return;

    const task = view.allTasks.find((t) => t.id === data.taskId);
    if (!task || !task.startDate) return;

    const oldStart = new Date(task.startDate);
    const newStart = new Date(dateStr);
    const deltaDays = Math.round(
      (newStart.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    await view.shiftTask(task, deltaDays);
  });
}

// ── Context menu ─────────────────────────────────────

function showProjectContextMenu(
  view: TaskCalendarView,
  project: Project,
  x: number,
  y: number
) {
  const menu = new Menu();
  menu.addItem((item) => {
    item.setTitle("编辑").setIcon("pencil").onClick(() => {
      const modal = new ProjectModal(
        view.app,
        view.plugin,
        project,
        (updated: Project) => {
          const idx = view.plugin.settings.projects.findIndex((p) => p.id === project.id);
          if (idx !== -1) view.plugin.settings.projects[idx] = updated;
          view.plugin.saveSettings();
          view.render();
        },
        () => {
          view.plugin.settings.projects = view.plugin.settings.projects.filter(
            (p) => p.id !== project.id
          );
          view.plugin.saveSettings();
          view.render();
        }
      );
      modal.open();
    });
  });
  menu.showAtPosition({ x, y });
}

// ── Utilities ────────────────────────────────────────

function buildDateRange(today: Date): string[] {
  const start = new Date(today);
  start.setDate(start.getDate() - DAYS_PAST);
  const result: string[] = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    result.push(formatDateStr(d));
  }
  return result;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
