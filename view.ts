import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import TaskCalendarPlugin from "./main";
import { ColorRule, FilterRule, ViewMode } from "./settings";
import {
  getQueryFiles,
  isFileInQueryPaths,
  groupTasksByDate,
  parseFileTasks,
  updateTaskDates,
  shiftTaskDates,
  Task,
  isMultiDayTask,
} from "./taskParser";
import { createTranslator, Translator } from "./i18n";

export const VIEW_TYPE_CALENDAR = "task-calendar-view";

interface TaskUpdate {
  files?: TFile[];
  deletedPaths?: string[];
  renamed?: { file: TFile; oldPath: string };
}

export class TaskCalendarView extends ItemView {
  plugin: TaskCalendarPlugin;
  currentDate: Date;
  viewMode: ViewMode;
  t: Translator;
  private _renderTimeout: number | null = null;
  // Per-file parsed tasks so a single file change never rescans the whole vault.
  private _taskCache = new Map<string, Task[]>();

  constructor(leaf: WorkspaceLeaf, plugin: TaskCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
    this.viewMode = "month";
    this.t = createTranslator(plugin.app);
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
          this.scheduleRender({ files: [file] });
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.scheduleRender({ deletedPaths: [file.path] });
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.scheduleRender({ files: [file] });
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          this.scheduleRender({ renamed: { file, oldPath } });
        }
      })
    );

    await this.loadTasks();
    this.render();
  }

  async onClose() {
    this.containerEl.empty();
  }

  private scheduleRender(update?: TaskUpdate) {
    if (this._renderTimeout) {
      window.clearTimeout(this._renderTimeout);
    }
    this._renderTimeout = window.setTimeout(async () => {
      this._renderTimeout = null;
      await this.loadTasks(update);
      this.render();
    }, 250);
  }

  /**
   * Without an update this rescans every file in scope (initial open, or the
   * query paths changed). With an update only the affected files are
   * re-parsed; the rest of the cache is reused.
   */
  async loadTasks(update?: TaskUpdate) {
    if (!update) {
      this._taskCache.clear();
      for (const file of getQueryFiles(
        this.app,
        this.plugin.settings.queryPaths
      )) {
        const content = await this.app.vault.read(file);
        this._taskCache.set(file.path, parseFileTasks(content, file.path));
      }
      return;
    }

    if (update.renamed) {
      this._taskCache.delete(update.renamed.oldPath);
    }
    for (const path of update.deletedPaths ?? []) {
      this._taskCache.delete(path);
    }
    for (const file of update.files ?? []) {
      if (
        !isFileInQueryPaths(file.path, this.plugin.settings.queryPaths)
      ) {
        continue;
      }
      const content = await this.app.vault.read(file);
      this._taskCache.set(file.path, parseFileTasks(content, file.path));
    }
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
    const result: Task[] = [];
    for (const tasks of this._taskCache.values()) {
      result.push(...tasks);
    }
    return result;
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
    const filtered = this.allTasks.filter((t) => !this.isTaskFiltered(t));
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
    const filtered = this.allTasks.filter((t) => !this.isTaskFiltered(t));
    return filtered.filter((t) => {
      if (!t.startDate) return false;
      const end = t.dueDate || t.startDate;
      return dateStr >= t.startDate && dateStr <= end;
    });
  }

  // ── Date update ────────────────────────────────────────

  async updateTaskDate(
    task: Task,
    newStartDate: string,
    newDueDate: string
  ): Promise<boolean> {
    const ok = await updateTaskDates(
      this.app,
      task,
      newStartDate,
      newDueDate
    );
    if (!ok) {
      new Notice(this.t("notice.updateFailed"));
      return false;
    }
    await this.refreshTaskFile(task);
    this.render();
    return true;
  }

  async shiftTask(task: Task, days: number): Promise<boolean> {
    const shifted = shiftTaskDates(task, days);
    const ok = await updateTaskDates(
      this.app,
      task,
      shifted.startDate,
      shifted.dueDate
    );
    if (!ok) {
      new Notice(this.t("notice.updateFailed"));
      return false;
    }
    await this.refreshTaskFile(task);
    this.render();
    return true;
  }

  private async refreshTaskFile(task: Task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (file instanceof TFile) {
      await this.loadTasks({ files: [file] });
    } else {
      await this.loadTasks();
    }
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