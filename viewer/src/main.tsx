import "./app/app.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

document.body.style.margin = "0";
document.body.style.background = "#0b1115";
document.body.style.color = "#edf2f7";
document.body.style.fontFamily = "\"IBM Plex Sans\", \"Segoe UI\", sans-serif";

void bootstrap(root);

async function bootstrap(container: HTMLElement) {
  try {
    const [{ default: React }, ReactDOM, { App }] = await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("./app/App"),
    ]);

    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (error) {
    renderBootstrapError(container, error);
  }
}

function renderBootstrapError(container: HTMLElement, error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  container.innerHTML = `
    <div style="padding:24px;max-width:920px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#ffb14f">Viewer Error</div>
      <h1 style="margin:8px 0 16px;font-size:32px">Frontend bootstrap failed</h1>
      <pre style="white-space:pre-wrap;background:#121b22;border:1px solid #243340;border-radius:12px;padding:16px;color:#ff7b72">${escapeHtml(message)}</pre>
      <p style="color:#9ca9b5;line-height:1.5">Open DevTools if you want more detail, but this message should now identify the failing import or runtime path.</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
