import { THEME_MEDIA_QUERY, THEME_STORAGE_KEY } from "./constants";

const LIGHT_THEME_COLOR = "#FAFAFB";
const DARK_THEME_COLOR = "#080A0F";

const script = `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var query = ${JSON.stringify(THEME_MEDIA_QUERY)};
    var stored = window.localStorage.getItem(key);
    var preference = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var systemDark = window.matchMedia && window.matchMedia(query).matches;
    var resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
    var root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
    var meta = document.querySelector('meta[name="theme-color"][data-urban-runtime-theme]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("data-urban-runtime-theme", "true");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", resolved === "dark" ? ${JSON.stringify(DARK_THEME_COLOR)} : ${JSON.stringify(LIGHT_THEME_COLOR)});
  } catch (error) {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
  }
})();
`;

export function ThemeScript() {
  return (
    <script
      id="urban-theme-script"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
