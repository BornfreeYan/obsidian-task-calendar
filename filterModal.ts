import { App, Modal } from "obsidian";
import TaskCalendarPlugin from "./main";
import { FilterRule } from "./settings";

const PROPERTY_LABELS: Record<FilterRule["property"], string> = {
  tags: "标签",
  priority: "优先级",
  description: "描述",
};

export class FilterModal extends Modal {
  plugin: TaskCalendarPlugin;
  private rules: FilterRule[];
  private contentArea: HTMLDivElement;

  constructor(app: App, plugin: TaskCalendarPlugin) {
    super(app);
    this.plugin = plugin;
    this.rules = plugin.settings.filterRules.map((r) => ({ ...r }));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("filter-modal");

    contentEl.createEl("h3", { text: "筛选排除" });
    contentEl.createEl("div", {
      cls: "modal-helper-text",
      text: "标签：填写标签名（不含#），如 工作、数学。优先级：填写 high / medium / low / none。描述：填写关键词匹配任务文本。",
    });

    this.contentArea = contentEl.createDiv({ cls: "filter-rules-list" });
    this.renderRuleList();

    const addBtn = contentEl.createEl("button", {
      cls: "filter-add-btn",
      text: "+ 新增筛选",
    });
    addBtn.addEventListener("click", () => this.addRule());

    const footer = contentEl.createDiv({ cls: "filter-footer" });

    const cancelBtn = footer.createEl("button", { text: "取消" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", {
      cls: "mod-cta",
      text: "完成",
    });
    saveBtn.addEventListener("click", () => {
      this.plugin.settings.filterRules = this.rules.filter(
        (r) => r.keyword.trim()
      );
      this.plugin.saveSettings();
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderRuleList() {
    this.contentArea.empty();

    if (this.rules.length === 0) {
      this.contentArea.createDiv({
        cls: "filter-rules-empty",
        text: "暂无筛选规则，点击下方按钮新增",
      });
      return;
    }

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      const row = this.contentArea.createDiv({ cls: "filter-rule-row" });

      // Property selector
      const selectWrapper = row.createDiv({ cls: "filter-select-wrap" });
      const select = selectWrapper.createEl("select", { cls: "filter-select" });
      for (const [value, label] of Object.entries(PROPERTY_LABELS)) {
        select.createEl("option", { text: label, value });
      }
      select.value = rule.property;
      select.addEventListener("change", () => {
        rule.property = select.value as FilterRule["property"];
      });

      row.createSpan({ cls: "filter-contains", text: "包含" });

      const keywordInput = row.createEl("input", {
        cls: "filter-keyword",
        type: "text",
        value: rule.keyword,
        attr: { placeholder: "关键词" },
      });
      keywordInput.addEventListener("input", () => {
        rule.keyword = keywordInput.value;
      });

      const toggleWrapper = row.createDiv({ cls: "filter-toggle" });
      const toggle = toggleWrapper.createEl("input", {
        type: "checkbox",
        attr: { id: `filter-toggle-${i}` },
      });
      toggle.checked = rule.enabled;
      toggle.addEventListener("change", () => {
        rule.enabled = toggle.checked;
      });

      const deleteBtn = row.createEl("button", {
        cls: "filter-delete",
        text: "\u00d7",
      });
      deleteBtn.addEventListener("click", () => {
        this.rules.splice(i, 1);
        this.renderRuleList();
      });
    }
  }

  private addRule() {
    this.rules.push({
      id: crypto.randomUUID(),
      property: "tags",
      keyword: "",
      enabled: true,
    });
    this.renderRuleList();
  }
}
