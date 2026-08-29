import { App, Modal } from "obsidian";
import TaskCalendarPlugin from "./main";
import { FilterRule } from "./settings";
import { createTranslator, Translator } from "./i18n";

const PROPERTY_LABEL_KEYS: Record<FilterRule["property"], string> = {
  tags: "prop.tags",
  description: "prop.description",
};

export class FilterModal extends Modal {
  plugin: TaskCalendarPlugin;
  private rules: FilterRule[];
  private contentArea: HTMLDivElement;
  private t: Translator;

  constructor(app: App, plugin: TaskCalendarPlugin) {
    super(app);
    this.plugin = plugin;
    this.t = createTranslator(app);
    this.rules = plugin.settings.filterRules.map((r) => ({ ...r }));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("filter-modal");

    contentEl.createEl("h3", { text: this.t("filter.title") });
    contentEl.createEl("div", {
      cls: "modal-helper-text",
      text: this.t("filter.helper"),
    });

    this.contentArea = contentEl.createDiv({ cls: "filter-rules-list" });
    this.renderRuleList();

    const addBtn = contentEl.createEl("button", {
      cls: "filter-add-btn",
      text: this.t("filter.add"),
    });
    addBtn.addEventListener("click", () => this.addRule());

    const footer = contentEl.createDiv({ cls: "filter-footer" });

    const cancelBtn = footer.createEl("button", { text: this.t("common.cancel") });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", {
      cls: "mod-cta",
      text: this.t("common.done"),
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
        text: this.t("filter.empty"),
      });
      return;
    }

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      const row = this.contentArea.createDiv({ cls: "filter-rule-row" });

      // Property selector
      const selectWrapper = row.createDiv({ cls: "filter-select-wrap" });
      const select = selectWrapper.createEl("select", { cls: "filter-select" });
      for (const [value, key] of Object.entries(PROPERTY_LABEL_KEYS)) {
        select.createEl("option", { text: this.t(key), value });
      }
      select.value = rule.property;
      select.addEventListener("change", () => {
        rule.property = select.value as FilterRule["property"];
      });

      row.createSpan({ cls: "filter-contains", text: this.t("filter.contains") });

      const keywordInput = row.createEl("input", {
        cls: "filter-keyword",
        type: "text",
        value: rule.keyword,
        attr: { placeholder: this.t("filter.keywordPlaceholder") },
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
