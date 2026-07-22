import { Plugin, WorkspaceLeaf } from "obsidian";
import { TaskCalendarView, VIEW_TYPE_CALENDAR } from "./view";
import { TaskCalendarSettings, DEFAULT_SETTINGS } from "./settings";

export default class TaskCalendarPlugin extends Plugin {
  settings: TaskCalendarSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf: WorkspaceLeaf) => new TaskCalendarView(leaf, this)
    );

    this.addRibbonIcon("calendar", "Open Task Calendar", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-task-calendar-view",
      name: "Open Task Calendar",
      callback: () => {
        this.activateView();
      },
    });
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf("tab");
      await leaf?.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
