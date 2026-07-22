import { App, Modal } from "obsidian";
import TaskCalendarPlugin from "./main";
import { ColorRule, DisplayMode, PRESET_COLORS } from "./settings";

const DISPLAY_MODE_LABEL: Record<DisplayMode, string> = {
  bar: "标签条",
  block: "整块",
};

const PROPERTY_LABELS: Record<ColorRule["property"], string> = {
  tags: "标签",
  priority: "优先级",
  description: "描述",
};

export class ColorRulesModal extends Modal {
  plugin: TaskCalendarPlugin;
  private rules: ColorRule[];
  private contentArea: HTMLDivElement;

  constructor(app: App, plugin: TaskCalendarPlugin) {
    super(app);
    this.plugin = plugin;
    this.rules = plugin.settings.colorRules.map((r) => ({ ...r }));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("color-rules-modal");

    contentEl.createEl("h3", { text: "分类配色" });
    contentEl.createEl("div", {
      cls: "modal-helper-text",
      text: "标签：填写标签名（不含#），如 工作、数学。优先级：填写 high / medium / low / none。描述：填写关键词匹配任务文本。",
    });

    this.contentArea = contentEl.createDiv({ cls: "color-rules-list" });
    this.renderRuleList();

    const addBtn = contentEl.createEl("button", {
      cls: "color-rules-add-btn",
      text: "+ 新增规则",
    });
    addBtn.addEventListener("click", () => this.addRule());

    const footer = contentEl.createDiv({ cls: "color-rules-footer" });

    const cancelBtn = footer.createEl("button", { text: "取消" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = footer.createEl("button", {
      cls: "mod-cta",
      text: "完成",
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
        text: "暂无规则，点击下方按钮新增",
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
      for (const [value, label] of Object.entries(PROPERTY_LABELS)) {
        propSelect.createEl("option", { text: label, value });
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
        attr: { placeholder: "关键词" },
      });
      keywordInput.addEventListener("input", () => {
        rule.keyword = keywordInput.value;
      });

      // Display mode toggle
      const modeBtn = row.createEl("button", {
        cls: "color-rule-mode-btn",
        text: DISPLAY_MODE_LABEL[rule.displayMode],
      });
      modeBtn.addEventListener("click", () => {
        rule.displayMode = rule.displayMode === "bar" ? "block" : "bar";
        modeBtn.setText(DISPLAY_MODE_LABEL[rule.displayMode]);
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
    const sep = popover.createDiv({ cls: "color-picker-sep", text: "整块底色推荐" });
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
