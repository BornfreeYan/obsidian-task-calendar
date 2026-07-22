import { App, Modal } from "obsidian";
import TaskCalendarPlugin from "./main";
import { Project } from "./settings";

export class ProjectModal extends Modal {
  plugin: TaskCalendarPlugin;
  private project: Project;
  private onSubmit: (project: Project) => void;
  private onDelete?: () => void;
  private dirList: HTMLElement | null = null;

  constructor(
    app: App,
    plugin: TaskCalendarPlugin,
    existing?: Project,
    onSubmit?: (project: Project) => void,
    onDelete?: () => void
  ) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit || (() => {});
    this.onDelete = onDelete;

    this.project = existing
      ? { ...existing }
      : {
          id: crypto.randomUUID(),
          name: "",
          filterType: "path",
          filterValue: "",
          enabled: true,
        };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("project-modal");

    contentEl.createEl("h3", {
      text: this.project.name ? `编辑项目: ${this.project.name}` : "新增项目",
    });

    // Name
    const nameRow = contentEl.createDiv({ cls: "project-form-row" });
    nameRow.createSpan({ cls: "project-form-label", text: "名称" });
    const nameInput = nameRow.createEl("input", {
      cls: "project-form-input",
      type: "text",
      value: this.project.name,
      attr: { placeholder: "如：工作项目" },
    });
    nameInput.addEventListener("input", () => {
      this.project.name = nameInput.value;
    });

    // Filter type
    const typeRow = contentEl.createDiv({ cls: "project-form-row" });
    typeRow.createSpan({ cls: "project-form-label", text: "筛选方式" });
    const typeSelect = typeRow.createEl("select", { cls: "project-form-select" });
    typeSelect.createEl("option", { text: "文件夹", value: "path" });
    typeSelect.createEl("option", { text: "标签", value: "tag" });
    typeSelect.value = this.project.filterType;
    typeSelect.addEventListener("change", () => {
      this.project.filterType = typeSelect.value as "path" | "tag";
      this.renderDirPicker(contentEl);
    });

    // Filter value
    const valRow = contentEl.createDiv({ cls: "project-form-row" });
    valRow.createSpan({ cls: "project-form-label", text: "筛选值" });
    const valInput = valRow.createEl("input", {
      cls: "project-form-input project-form-val",
      type: "text",
      value: this.project.filterValue,
      attr: { placeholder: "文件夹路径 或 标签名" },
    });
    valInput.addEventListener("input", () => {
      this.project.filterValue = valInput.value;
      if (this.dirList) this.highlightDir();
    });

    // Folder picker (only for path type)
    this.renderDirPicker(contentEl);

    const footer = contentEl.createDiv({ cls: "project-form-footer" });

    if (this.onDelete) {
      const deleteBtn = footer.createEl("button", { cls: "project-delete-btn", text: "删除" });
      deleteBtn.addEventListener("click", () => {
        this.onDelete!();
        this.close();
      });
    }

    const spacer = footer.createDiv({ cls: "project-form-spacer" });

    const cancelBtn = footer.createEl("button", { text: "取消" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", { cls: "mod-cta", text: "保存" });
    saveBtn.addEventListener("click", () => {
      if (!this.project.name.trim() || !this.project.filterValue.trim()) return;
      this.onSubmit(this.project);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderDirPicker(contentEl: HTMLElement) {
    // Remove old picker
    const old = contentEl.querySelector(".project-dir-picker");
    if (old) old.remove();

    if (this.project.filterType !== "path") return;

    const dirs = getVaultDirectories(this.app);
    if (dirs.length === 0) return;

    const picker = contentEl.createDiv({ cls: "project-dir-picker" });
    picker.createDiv({ cls: "project-dir-picker-label", text: "选择目录:" });

    this.dirList = picker.createDiv({ cls: "project-dir-list" });

    for (const d of dirs) {
      const item = this.dirList.createDiv({
        cls: `project-dir-item${d === this.project.filterValue ? " selected" : ""}`,
        text: d || "(根目录)",
      });
      item.addEventListener("click", () => {
        this.project.filterValue = d;
        this.highlightDir();
        // Update the text input
        const valInput = contentEl.querySelector(".project-form-val") as HTMLInputElement;
        if (valInput) valInput.value = d;
      });
    }
  }

  private highlightDir() {
    if (!this.dirList) return;
    const items = this.dirList.querySelectorAll(".project-dir-item");
    items.forEach((el) => {
      const div = el as HTMLElement;
      const text = div.textContent || "";
      const actual = text === "(根目录)" ? "" : text;
      if (actual === this.project.filterValue) {
        div.addClass("selected");
      } else {
        div.removeClass("selected");
      }
    });
  }
}

export function getVaultDirectories(app: App): string[] {
  const dirs = new Set<string>();
  dirs.add(""); // root
  for (const file of app.vault.getMarkdownFiles()) {
    const parts = file.path.split("/");
    parts.pop();
    let path = "";
    for (const part of parts) {
      path += (path ? "/" : "") + part;
      dirs.add(path);
    }
  }
  return Array.from(dirs).sort();
}
