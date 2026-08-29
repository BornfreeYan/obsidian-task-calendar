import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import TaskCalendarPlugin from "./main";
import { ColorRule, FilterRule, ViewMode } from "./settings";
import { getAllTasks, groupTasksByDate, updateTaskDates, shiftTaskDates, Task, isMultiDayTask } from "./taskParser";

export const VIEW_TYPE_CALENDAR = "task-calendar-view";

export class TaskCalendarView extends ItemView {
  plugin: TaskCalendarPlugin;
  currentDate: Date;
  viewMode: ViewMode;
  private _renderTimeout: number | null = null;
  private _allTasks: Task[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: TaskCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
    this.viewMode = "month";
  }

  getViewType() {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText() {
    return "Task Calendar";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen() {
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.extension === "md") {
          this.scheduleRender();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.scheduleRender();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.scheduleRender();
        }
      })
    );

    await this.loadTasks();
    this.render();
  }

  async onClose() {
    this.containerEl.empty();
  }

  private scheduleRender() {
    if (this._renderTimeout) {
      window.clearTimeout(this._renderTimeout);
    }
    this._renderTimeout = window.setTimeout(async () => {
      this._renderTimeout = null;
      await this.loadTasks();
      this.render();
    }, 250);
  }

  async loadTasks() {
    this._allTasks = await getAllTasks(
      this.app,
      this.plugin.settings.queryPaths
    );
  }

  render() {
    if (this._renderTimeout) {
      window.clearTimeout(this._renderTimeout);
      this._renderTimeout = null;
    }
    this.containerEl.empty();
    const container = this.containerEl.createDiv({ cls: "calendar-view-container" });
    // Lazy import to avoid circular dependency if we ever need it
    const { renderCalendar } = require("./calendar");
    renderCalendar(container, this);
  }

  get allTasks(): Task[] {
    return this._allTasks;
  }

  get hasActiveFilters(): boolean {
    return this.plugin.settings.filterRules.some(
      (r) => r.enabled && r.keyword.trim()
    );
  }

  private getEnabledColorRules(): ColorRule[] {
    return this.plugin.settings.colorRules.filter(
      (r) => r.enabled && r.keyword.trim()
    );
  }

  private getEnabledFilterRules(): FilterRule[] {
    return this.plugin.settings.filterRules.filter(
      (r) => r.enabled && r.keyword.trim()
    );
  }

  // ── Filter matching ──────────────────────────────────────

  private isTaskFiltered(task: Task): boolean {
    const filters = this.getEnabledFilterRules();
    return filters.some((f) => this.taskMatchesFilter(task, f));
  }

  private taskMatchesFilter(task: Task, filter: FilterRule): boolean {
    const keyword = filter.keyword.toLowerCase();
    switch (filter.property) {
      case "tags":
        return task.tags.some((t) => t.toLowerCase().includes(keyword));
      case "priority":
        return task.priority.toLowerCase().includes(keyword);
      case "description":
        return task.description.toLowerCase().includes(keyword);
    }
    return false;
  }

  // ── Color matching: bar mode ───────────────────────────

  getMatchingBarColors(task: Task): string[] {
    const rules = this.getEnabledColorRules().filter((r) => r.displayMode === "bar");
    const colors: string[] = [];
    for (const rule of rules) {
      if (this.taskMatchesColorRule(task, rule)) {
        colors.push(rule.color);
        if (colors.length >= 3) break;
      }
    }
    return colors;
  }

  // ── Color matching: block mode ─────────────────────────

  getBlockTintColor(task: Task): string | null {
    const rules = this.getEnabledColorRules().filter((r) => r.displayMode === "block");
    for (const rule of rules) {
      if (this.taskMatchesColorRule(task, rule)) {
        return rule.color;
      }
    }
    return null;
  }

  private taskMatchesColorRule(task: Task, rule: ColorRule): boolean {
    const keyword = rule.keyword.toLowerCase();
    switch (rule.property) {
      case "tags":
        return task.tags.some((t) => t.toLowerCase() === keyword);
      case "priority":
        return task.priority.toLowerCase() === keyword;
      case "description":
        return task.description.toLowerCase().includes(keyword);
    }
    return false;
  }

  // ── Sort priority ──────────────────────────────────────

  private getTaskSortPriority(task: Task): number {
    const rules = this.getEnabledColorRules();
    for (let i = 0; i < rules.length; i++) {
      if (this.taskMatchesColorRule(task, rules[i])) return i;
    }
    return rules.length;
  }

  // ── Tasks grouping ─────────────────────────────────────

  getTasksWithDate(): Map<string, Task[]> {
    const filtered = this._allTasks.filter((t) => !this.isTaskFiltered(t));
    const byDate = groupTasksByDate(filtered);

    // Sort tasks within each date
    for (const [dateStr, tasks] of byDate) {
      tasks.sort((a, b) => {
        const pa = this.getTaskSortPriority(a);
        const pb = this.getTaskSortPriority(b);
        if (pa !== pb) return pa - pb;
        return a.description.localeCompare(b.description);
      });
    }

    return byDate;
  }

  getTasksForDate(dateStr: string): Task[] {
    const filtered = this._allTasks.filter((t) => !this.isTaskFiltered(t));
    return filtered.filter((t) => {
      if (!t.startDate) return false;
      const end = t.dueDate || t.startDate;
      return dateStr >= t.startDate && dateStr <= end;
    });
  }

  // ── Date update ────────────────────────────────────────

  async updateTaskDate(task: Task, newStartDate: string, newDueDate: string) {
    await updateTaskDates(this.app, task, newStartDate, newDueDate);
    // Refresh cache
    await this.loadTasks();
    this.render();
  }

  async shiftTask(task: Task, days: number) {
    const shifted = shiftTaskDates(task, days);
    await updateTaskDates(this.app, task, shifted.startDate, shifted.dueDate);
    await this.loadTasks();
    this.render();
  }

  // ── Open file at line ──────────────────────────────────

  async openTaskFile(task: Task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof TFile)) return;

    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);

    const view = leaf.view;
    if (view && "editor" in view) {
      const editor = (view as any).editor;
      if (editor && typeof editor.setCursor === "function") {
        editor.setCursor({ line: task.lineNumber, ch: 0 });
      }
    }
  }
}
