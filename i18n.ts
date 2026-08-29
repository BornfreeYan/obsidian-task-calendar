import type { App } from "obsidian";

/*
 * Minimal two-language (Chinese / English) UI strings.
 * Language follows the Obsidian UI language automatically; extend the
 * dictionaries below when adding new UI text.
 */

const zh: Record<string, string> = {
  "mode.month": "月",
  "mode.week": "周",
  "toolbar.scanPaths": "扫描路径",
  "toolbar.colorRules": "分类配色",
  "toolbar.filter": "筛选",
  "header.today": "今天",
  "axis.adjustStart": "调整起始日期",
  "axis.adjustDue": "调整终止日期",
  "ctx.newTask": "新建任务",
  "create.title": "新建任务",
  "create.placeholder": "任务描述",
  "common.cancel": "取消",
  "common.create": "创建",
  "common.save": "保存",
  "common.done": "完成",
  "notice.updateFailed": "任务日期更新失败，任务行可能已被修改",
  "filter.title": "筛选排除",
  "filter.helper":
    "标签：填写标签名（不含#），如 工作、数学。优先级：填写 high / medium / low / none。描述：填写关键词匹配任务文本。",
  "filter.add": "+ 新增筛选",
  "filter.empty": "暂无筛选规则，点击下方按钮新增",
  "filter.contains": "包含",
  "filter.keywordPlaceholder": "关键词",
  "color.title": "分类配色",
  "color.helper":
    "标签：填写标签名（不含#），如 工作、数学。优先级：填写 high / medium / low / none。描述：填写关键词匹配任务文本。",
  "color.add": "+ 新增规则",
  "color.empty": "暂无规则，点击下方按钮新增",
  "color.modeBar": "标签条",
  "color.modeBlock": "整块",
  "color.blockPreset": "整块底色推荐",
  "query.title": "扫描路径",
  "query.desc": "选择要扫描任务的文件夹或文件。默认扫描所有文件。",
  "query.add": "+ 新增路径",
  "query.empty": "暂无路径，默认扫描所有文件",
  "query.allFiles": "(所有文件)",
  "prop.tags": "标签",
  "prop.priority": "优先级",
  "prop.description": "描述",
};

const en: Record<string, string> = {
  "mode.month": "Month",
  "mode.week": "Week",
  "toolbar.scanPaths": "Scan Paths",
  "toolbar.colorRules": "Color Rules",
  "toolbar.filter": "Filter",
  "header.today": "Today",
  "axis.adjustStart": "Adjust start date",
  "axis.adjustDue": "Adjust due date",
  "ctx.newTask": "New Task",
  "create.title": "New Task",
  "create.placeholder": "Task description",
  "common.cancel": "Cancel",
  "common.create": "Create",
  "common.save": "Save",
  "common.done": "Done",
  "notice.updateFailed":
    "Could not update the task date. The task line may have been modified.",
  "filter.title": "Filter Rules",
  "filter.helper":
    "Tags: enter the tag name (without #), e.g. work, math. Priority: enter high / medium / low / none. Description: enter a keyword that matches task text.",
  "filter.add": "+ Add Filter",
  "filter.empty": "No filter rules yet. Add one below.",
  "filter.contains": "contains",
  "filter.keywordPlaceholder": "Keyword",
  "color.title": "Color Rules",
  "color.helper":
    "Tags: enter the tag name (without #), e.g. work, math. Priority: enter high / medium / low / none. Description: enter a keyword that matches task text.",
  "color.add": "+ Add Rule",
  "color.empty": "No rules yet. Add one below.",
  "color.modeBar": "Bar",
  "color.modeBlock": "Block",
  "color.blockPreset": "Block tint suggestions",
  "query.title": "Scan Paths",
  "query.desc":
    "Choose folders or files to scan for tasks. Defaults to scanning all files.",
  "query.add": "+ Add Path",
  "query.empty": "No paths configured. Scanning all files.",
  "query.allFiles": "(All files)",
  "prop.tags": "Tags",
  "prop.priority": "Priority",
  "prop.description": "Description",
};

export type Translator = {
  language: "zh" | "en";
  (key: string): string;
};

/** Creates a translator whose language follows the Obsidian UI language. */
export function createTranslator(app: App): Translator {
  const language = detectLanguage(app);
  const dict = language === "zh" ? zh : en;
  const t = ((key: string) => dict[key] ?? key) as Translator;
  t.language = language;
  return t;
}

function detectLanguage(app: App): "zh" | "en" {
  try {
    const lang =
      (app as any).i18n?.language ??
      (window as any).moment?.locale?.() ??
      "en";
    return typeof lang === "string" && lang.toLowerCase().startsWith("zh")
      ? "zh"
      : "en";
  } catch {
    return "en";
  }
}