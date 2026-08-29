import { App, TFile } from "obsidian";
import { addDays, formatDateStr, isValidDateStr, parseLocalDate } from "./dateUtils";

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  filePath: string;
  lineNumber: number;
  startDate?: string; // 🛫
  dueDate?: string;   // 📅
  tags: string[];
  rawText: string;
}

/**
 * Parse all tasks from files under the specified paths.
 */
export async function getAllTasks(
  app: App,
  queryPaths: { path: string; enabled: boolean }[]
): Promise<Task[]> {
  const files = getQueryFiles(app, queryPaths);
  const tasks: Task[] = [];

  for (const file of files) {
    const content = await app.vault.read(file);
    tasks.push(...parseFileTasks(content, file.path));
  }

  return tasks;
}

/**
 * Parse a single file's content into tasks. Used both by the full scan and
 * by incremental updates when a file changes.
 */
export function parseFileTasks(content: string, filePath: string): Task[] {
  const lines = content.split("\n");
  const tasks: Task[] = [];
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseTaskLine(lines[i], filePath, i);
    if (parsed) {
      tasks.push(parsed);
    }
  }
  return tasks;
}

export function getQueryFiles(
  app: App,
  queryPaths: { path: string; enabled: boolean }[]
): TFile[] {
  return app.vault
    .getMarkdownFiles()
    .filter((f) => isFileInQueryPaths(f.path, queryPaths));
}

export function isFileInQueryPaths(
  filePath: string,
  queryPaths: { path: string; enabled: boolean }[]
): boolean {
  const enabledPaths = queryPaths.filter((p) => p.enabled).map((p) => p.path);
  if (enabledPaths.length === 0) return true;

  for (const qp of enabledPaths) {
    if (qp === "") return true;
    const prefix = qp.endsWith("/") ? qp : qp + "/";
    if (filePath === qp || filePath.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse a single line as a task. Returns null if not a task line.
 */
export function parseTaskLine(
  line: string,
  filePath: string,
  lineNumber: number
): Task | null {
  // Match: `- [ ] description` or `- [x] description`
  const taskMatch = line.match(/^\s*-\s*\[([ xX])\]\s+(.*)$/);
  if (!taskMatch) return null;

  const completed = taskMatch[1].toLowerCase() === "x";
  const rest = taskMatch[2];

  // Extract dates
  const startDate = extractDate(rest, "🛫");
  const dueDate = extractDate(rest, "📅");

  // If no dates at all, skip (user requirement: every task must have at least a start date)
  if (!startDate && !dueDate) return null;

  // If only one date exists, treat it as both start and due (single-day task)
  const finalStart = startDate || dueDate;
  const finalDue = dueDate || startDate;

  // Extract tags
  const tags = extractTags(rest);

  // Clean description: remove date markers and tags for display text
  let description = cleanDescription(rest);

  return {
    id: `${filePath}#${lineNumber}`,
    description,
    completed,
    filePath,
    lineNumber,
    startDate: finalStart,
    dueDate: finalDue,
    tags,
    rawText: line,
  };
}

function extractDate(text: string, emoji: string): string | undefined {
  // Match emoji followed by optional space and date in format YYYY-MM-DD
  const regex = new RegExp(
    `${escapeRegex(emoji)}\\s*(\\d{4}-\\d{2}-\\d{2})`
  );
  const match = text.match(regex);
  if (match && isValidDateStr(match[1])) {
    return match[1];
  }
  return undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  // Obsidian tag format: #tag or #multi-word-tag
  const regex = /#([\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  return tags;
}

function cleanDescription(text: string): string {
  let desc = text;
  // Remove date markers with their dates
  desc = desc.replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, "");
  desc = desc.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, "");
  desc = desc.replace(/⏳\s*\d{4}-\d{2}-\d{2}/g, "");
  desc = desc.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, "");
  // Remove tags
  desc = desc.replace(/#[\w-]+/g, "");
  // Clean up extra spaces
  desc = desc.trim().replace(/\s+/g, " ");
  return desc;
}

/**
 * Group tasks by a single date (for calendar views).
 * A task appears on each day within its [startDate, dueDate] range.
 */
export function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.startDate) continue;
    const start = task.startDate;
    const end = task.dueDate || start;

    const dates = getDateRange(start, end);
    for (const dateStr of dates) {
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(task);
    }
  }

  return map;
}

/**
 * Get all dates in range [start, end] inclusive.
 */
function getDateRange(start: string, end: string): string[] {
  const result: string[] = [];
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);

  // Ensure s <= e
  if (s > e) {
    return [start];
  }

  const current = new Date(s);
  while (current <= e) {
    result.push(formatDateStr(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Check if a task matches a date (within its range).
 */
export function taskCoversDate(task: Task, dateStr: string): boolean {
  if (!task.startDate) return false;
  const start = task.startDate;
  const end = task.dueDate || start;
  return dateStr >= start && dateStr <= end;
}

/**
 * Check if a task spans multiple days.
 */
export function isMultiDayTask(task: Task): boolean {
  if (!task.startDate || !task.dueDate) return false;
  return task.startDate !== task.dueDate;
}

/**
 * Update task dates in the original file.
 *
 * The line number captured at parse time can drift if the user edits the
 * file afterwards; when the expected line no longer matches the task's raw
 * text, fall back to searching the whole file. Returns false if the task
 * line can no longer be found, so the caller can notify the user.
 */
export async function updateTaskDates(
  app: App,
  task: Task,
  newStartDate: string,
  newDueDate: string
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(task.filePath);
  if (!(file instanceof TFile)) return false;

  const content = await app.vault.read(file);
  const lines = content.split("\n");

  const lineIndex = findTaskLine(lines, task);
  if (lineIndex === -1) return false;

  let line = lines[lineIndex];

  // Replace or add start date (🛫)
  if (line.includes("🛫")) {
    line = line.replace(/🛫\s*\d{4}-\d{2}-\d{2}/, `🛫 ${newStartDate}`);
  } else {
    line += ` 🛫 ${newStartDate}`;
  }

  // Replace or add due date (📅)
  if (line.includes("📅")) {
    line = line.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${newDueDate}`);
  } else {
    line += ` 📅 ${newDueDate}`;
  }

  lines[lineIndex] = line;
  await app.vault.modify(file, lines.join("\n"));
  return true;
}

function findTaskLine(lines: string[], task: Task): number {
  if (
    task.lineNumber >= 0 &&
    task.lineNumber < lines.length &&
    lines[task.lineNumber] === task.rawText
  ) {
    return task.lineNumber;
  }
  return lines.findIndex((l) => l === task.rawText);
}

/**
 * Shift both dates by a number of days.
 */
export function shiftTaskDates(
  task: Task,
  days: number
): { startDate: string; dueDate: string } {
  const newStart = addDays(task.startDate || "", days);
  const newDue = addDays(task.dueDate || task.startDate || "", days);
  return { startDate: newStart, dueDate: newDue };
}
