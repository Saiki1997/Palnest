import type { Locale } from "./ops.ts";

const EN: Record<string, string> = {
  home: "Home",
  mods: "Mods",
  discover: "Discover",
  frameworks: "Components",
  server: "Server",
  tunnels: "Tunnels",
  worlds: "Worlds",
  optimize: "Engine tweaks",
  checker: "Checker",
  logs: "Logs",
  settings: "Settings",
  status: "Status",
  start: "Start",
  stop: "Stop",
  join: "Join",
  newServer: "New Server",
};

const JA: Record<string, string> = {
  ...EN,
  home: "ホーム",
  mods: "モッド",
  discover: "探す",
  frameworks: "コンポーネント",
  server: "サーバー",
  tunnels: "トンネル",
  worlds: "ワールド",
  optimize: "エンジン調整",
  checker: "検査",
  logs: "ログ",
  settings: "設定",
  status: "ステータス",
  start: "起動",
  stop: "停止",
  join: "参加",
  newServer: "新規サーバー",
};

const ZH: Record<string, string> = {
  ...EN,
  home: "首页",
  mods: "模组",
  discover: "发现",
  frameworks: "组件",
  server: "服务器",
  tunnels: "隧道",
  worlds: "世界",
  optimize: "引擎调整",
  checker: "检查",
  logs: "日志",
  settings: "设置",
  status: "状态",
  start: "启动",
  stop: "停止",
  join: "加入",
  newServer: "新建服务器",
};

const TABLES: Record<Locale, Record<string, string>> = { en: EN, ja: JA, zh: ZH };

export function t(locale: Locale, key: string) {
  return TABLES[locale]?.[key] ?? EN[key] ?? key;
}

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "zh", label: "中文" },
];
