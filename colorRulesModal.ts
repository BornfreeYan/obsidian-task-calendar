import { App, Modal } from "obsidian";
import TaskCalendarPlugin from "./main";
import { ColorRule, DisplayMode, PRESET_COLORS } from "./settings";
import { createTranslator, Translator } from "./i18n";

const DISPLAY_MODE_KEYS: Record<DisplayMode, string> = {
  bar: "color.modeBar",
  block: "color.modeBlock",
};

const PROPERTY_LABEL_KEYS: Record<ColorRule["property"], string> = {
  tags: "prop.tags",
  description: "prop.description",
};

export class ColorRulesModal extends Modal {
  plugin: TaskCalendarPlugin;
  private rules: ColorRule[];
  private contentArea: HTMLDivElement;
  private t: Translator;

  constructor(app: App, plugin: TaskCalendarPlugin) {
    super(app);
    this.plugin = plugin;
    this.t = createTranslator(app);
    this.rules = plugin.settings.colorRules.map((r) => ({ ...r }));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("color-rules-modal");

    contentEl.createEl("h3", { text: this.t("color.title") });
    contentEl.createEl("div", {
      cls: "modal-helper-text",
      text: this.t("color.helper"),
    });

    this.contentArea = contentEl.createDiv({ cls: "color-rules-list" });
    this.renderRuleList();

    const addBtn = contentEl.createEl("button", {
      cls: "color-rules-add-btn",
      text: this.t("color.add"),
    });
    addBtn.addEventListener("click", () => this.addRule());

    const footer = contentEl.createDiv({ cls: "color-rules-footer" });

    const cancelBtn = footer.createEl("button", { text: this.t("common.cancel") });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", {
      cls: "mod-cta",
      text: this.t("common.done"),
    });
    saveBtn.addEventListener("click", () => {
      this.plugin.settings.colorRules = this.rules.filter(
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
        cls: "color-rules-empty",
        text: this.t("color.empty"),
      });
      return;
    }

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      const row = this.contentArea.createDiv({ cls: "color-rule-row" });

      const colorSwatch = row.createDiv({ cls: "color-rule-swatch" });
      colorSwatch.style.backgroundColor = rule.color;
      colorSwatch.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showColorPicker(colorSwatch, rule);
      });

      // Property selector
      const propSelect = row.createEl("select", { cls: "color-rule-field" });
      for (const [value, key] of Object.entries(PROPERTY_LABEL_KEYS)) {
        propSelect.createEl("option", { text: this.t(key), value });
      }
      propSelect.value = rule.property;
      propSelect.addEventListener("change", () => {
        rule.property = propSelect.value as ColorRule["property"];
      });

      row.createSpan({ cls: "color-rule-eq", text: "=" });

      const keywordInput = row.createEl("input", {
        cls: "color-rule-keyword",
        type: "text",
        value: rule.keyword,
        attr: { placeholder: this.t("filter.keywordPlaceholder") },
      });
      keywordInput.addEventListener("input", () => {
        rule.keyword = keywordInput.value;
      });

      // Display mode toggle
      const modeBtn = row.createEl("button", {
        cls: "color-rule-mode-btn",
        text: this.t(DISPLAY_MODE_KEYS[rule.displayMode]),
      });
      modeBtn.addEventListener("click", () => {
        rule.displayMode = rule.displayMode === "bar" ? "block" : "bar";
        modeBtn.setText(this.t(DISPLAY_MODE_KEYS[rule.displayMode]));
      });

      const toggleWrapper = row.createDiv({ cls: "color-rule-toggle" });
      const toggle = toggleWrapper.createEl("input", {
        type: "checkbox",
        attr: { id: `rule-toggle-${i}` },
      });
      toggle.checked = rule.enabled;
      toggle.addEventListener("change", () => {
        rule.enabled = toggle.checked;
      });

      const deleteBtn = row.createEl("button", {
        cls: "color-rule-delete",
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
      color: PRESET_COLORS[this.rules.length % PRESET_COLORS.length],
      property: "tags",
      keyword: "",
      enabled: true,
      displayMode: "bar",
    });
    this.renderRuleList();
  }

  private showColorPicker(anchor: HTMLElement, rule: ColorRule) {
    const existing = document.querySelector(".color-picker-popover");
    if (existing) existing.remove();

    const popover = document.body.createDiv({ cls: "color-picker-popover" });

    // Standard colors (first 16)
    const grid1 = popover.createDiv({ cls: "color-picker-grid" });
    for (const c of PRESET_COLORS.slice(0, 16)) {
      const swatch = grid1.createDiv({ cls: "color-picker-swatch" });
      swatch.style.backgroundColor = c;
      if (c === rule.color) swatch.addClass("selected");
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        rule.color = c;
        anchor.style.backgroundColor = c;
        popover.remove();
        this.renderRuleList();
      });
    }

    // Block-tint preset colors (last 4) with a subtle label
    const sep = popover.createDiv({ cls: "color-picker-sep", text: this.t("color.blockPreset") });
    const grid2 = popover.createDiv({ cls: "color-picker-grid" });
    for (const c of PRESET_COLORS.slice(16)) {
      const swatch = grid2.createDiv({ cls: "color-picker-swatch" });
      swatch.style.backgroundColor = c;
      if (c === rule.color) swatch.addClass("selected");
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        rule.color = c;
        anchor.style.backgroundColor = c;
        popover.remove();
        this.renderRuleList();
      });
    }

    const closeHandler = (e: MouseEvent) => {
      if (!popover.contains(e.target as Node) && e.target !== anchor) {
        popover.remove();
        document.removeEventListener("click", closeHandler);
        this.renderRuleList();
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeHandler);
    }, 0);

    const rect = anchor.getBoundingClientRect();
    popover.style.position = "fixed";
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`;
    popover.style.zIndex = "1000";
  }
}
