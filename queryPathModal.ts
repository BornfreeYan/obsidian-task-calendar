import { App, Modal, TFile, TFolder } from "obsidian";
import TaskCalendarPlugin from "./main";
import { createTranslator, Translator } from "./i18n";

export class QueryPathModal extends Modal {
  plugin: TaskCalendarPlugin;
  private onSave: () => void;
  private pathList: HTMLElement;
  private t: Translator;

  constructor(app: App, plugin: TaskCalendarPlugin, onSave: () => void) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
    this.t = createTranslator(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("query-path-modal");

    contentEl.createEl("h3", { text: this.t("query.title") });
    contentEl.createEl("p", {
      cls: "query-path-desc",
      text: this.t("query.desc"),
    });

    this.pathList = contentEl.createDiv({ cls: "query-path-list" });
    this.renderPathList();

    const addBtn = contentEl.createEl("button", {
      cls: "query-path-add-btn",
      text: this.t("query.add"),
    });
    addBtn.addEventListener("click", () => this.addPath());

    const footer = contentEl.createDiv({ cls: "query-path-footer" });

    const cancelBtn = footer.createEl("button", { text: this.t("common.cancel") });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", { cls: "mod-cta", text: this.t("common.save") });
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
        text: this.t("query.empty"),
      });
      return;
    }

    // Get all markdown files and folders for the picker
    const allFiles = this.app.vault.getAllLoadedFiles();
    const mdFiles = allFiles.filter((f) => f instanceof TFile && f.extension === "md") as TFile[];
    const folders = allFiles.filter((f) => f instanceof TFolder) as TFolder[];

    const items = [
      { value: "", label: this.t("query.allFiles") },
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
