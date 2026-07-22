import { App, Modal, TFile, TFolder } from "obsidian";
import TaskCalendarPlugin from "./main";

export class QueryPathModal extends Modal {
  plugin: TaskCalendarPlugin;
  private onSave: () => void;
  private pathList: HTMLElement;

  constructor(app: App, plugin: TaskCalendarPlugin, onSave: () => void) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("query-path-modal");

    contentEl.createEl("h3", { text: "\u626b\u63cf\u8def\u5f84" });
    contentEl.createEl("p", {
      cls: "query-path-desc",
      text: "\u9009\u62e9\u8981\u626b\u63cf\u4efb\u52a1\u7684\u6587\u4ef6\u5939\u6216\u6587\u4ef6\u3002\u9ed8\u8ba4\u626b\u63cf\u6240\u6709\u6587\u4ef6\u3002",
    });

    this.pathList = contentEl.createDiv({ cls: "query-path-list" });
    this.renderPathList();

    const addBtn = contentEl.createEl("button", {
      cls: "query-path-add-btn",
      text: "+ \u65b0\u589e\u8def\u5f84",
    });
    addBtn.addEventListener("click", () => this.addPath());

    const footer = contentEl.createDiv({ cls: "query-path-footer" });

    const cancelBtn = footer.createEl("button", { text: "\u53d6\u6d88" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", { cls: "mod-cta", text: "\u4fdd\u5b58" });
    saveBtn.addEventListener("click", () => {
      this.plugin.saveSettings().then(() => {
        this.onSave();
        this.close();
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderPathList() {
    this.pathList.empty();
    const paths = this.plugin.settings.queryPaths;

    if (paths.length === 0) {
      this.pathList.createDiv({
        cls: "query-path-empty",
        text: "\u6682\u65e0\u8def\u5f84\uff0c\u9ed8\u8ba4\u626b\u63cf\u6240\u6709\u6587\u4ef6",
      });
      return;
    }

    // Get all markdown files and folders for the picker
    const allFiles = this.app.vault.getAllLoadedFiles();
    const mdFiles = allFiles.filter((f) => f instanceof TFile && f.extension === "md") as TFile[];
    const folders = allFiles.filter((f) => f instanceof TFolder) as TFolder[];

    const items = [
      { value: "", label: "(\u6240\u6709\u6587\u4ef6)" },
      ...folders.map((f) => ({ value: f.path, label: `\ud83d\udcc1 ${f.path}` })),
      ...mdFiles.map((f) => ({ value: f.path, label: `\ud83d\udcdd ${f.path}` })),
    ].sort((a, b) => a.label.localeCompare(b.label));

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const row = this.pathList.createDiv({ cls: "query-path-row" });

      const select = row.createEl("select", { cls: "query-path-select" });
      for (const item of items) {
        select.createEl("option", { text: item.label, value: item.value });
      }
      select.value = path.path;
      select.addEventListener("change", () => {
        path.path = select.value;
      });

      const toggleWrapper = row.createDiv({ cls: "query-path-toggle" });
      const toggle = toggleWrapper.createEl("input", {
        type: "checkbox",
        attr: { id: `qp-toggle-${i}` },
      });
      toggle.checked = path.enabled;
      toggle.addEventListener("change", () => {
        path.enabled = toggle.checked;
      });

      const deleteBtn = row.createEl("button", {
        cls: "query-path-delete",
        text: "\u00d7",
      });
      deleteBtn.addEventListener("click", () => {
        paths.splice(i, 1);
        this.renderPathList();
      });
    }
  }

  private addPath() {
    this.plugin.settings.queryPaths.push({
      id: crypto.randomUUID(),
      path: "",
      enabled: true,
    });
    this.renderPathList();
  }
}
