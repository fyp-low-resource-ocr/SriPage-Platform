"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState,
} from "react";

type Job = {
  id: string;
  filename: string;
  method: string;
  status: string;
  queuePosition: number | null;
  result: unknown;
  error: string | null;
  createdAt: string;
};
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const ACCEPT =
  ".pdf,.csv,.xlsx,.json,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json";
const THEME_EVENT = "sripage-theme-change";
const themeStore = {
  subscribe: (onChange: () => void) => {
    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  },
  getSnapshot: (): "dark" | "light" => {
    const stored = window.localStorage.getItem("sripage-theme");
    return stored === "light" ? "light" : "dark";
  },
  getServerSnapshot: () => "dark" as const,
};

const ICON_PATHS: Record<string, string> = {
  notifications: "M12 22c1.1 0 1.99-.9 1.99-2h-3.98c0 1.1.89 2 1.99 2ZM18 16v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.62 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z",
  account_circle: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3Zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22Z",
  cloud_upload: "M19.35 10.04A7.49 7.49 0 0 0 12 4a7.5 7.5 0 0 0-7.35 6.04A5.994 5.994 0 0 0 6 22h13a6 6 0 0 0 .35-11.96ZM13 13v4h-2v-4H8l4-4 4 4h-3Z",
  insert_drive_file: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6Zm1 7V3.5L18.5 9H15Z",
  trending_up: "m16 6 2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6Z",
  timer: "M15 1H9v2h6V1Zm-1 13h-4V8h2v4h2v2Zm4.03-8.03 1.42-1.42a10.04 10.04 0 0 0-1.41-1.18l-1.42 1.42A8.94 8.94 0 0 0 12 3a9 9 0 1 0 9 9c0-2.2-.79-4.21-2.1-5.78l-1.42 1.42A7 7 0 1 1 12 5c1.56 0 3 .51 4.15 1.38l1.88 1.88Z",
  trending_down: "m16 18 2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6h-6Z",
  arrow_forward: "m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8Z",
  sync: "M12 10.4V9.8l-.8.8.8.8v-.6c.662 0 1.2.538 1.2 1.2 0 .202-.05.394-.14.56l.292.292A1.586 1.586 0 0 0 13.6 12c0-.884-.716-1.6-1.6-1.6Zm0 2.8c-.662 0-1.2-.538-1.2-1.2 0-.202.05-.394.14-.56l-.292-.292A1.586 1.586 0 0 0 10.4 12c0 .884.716 1.6 1.6 1.6v.6l.8-.8-.8-.8v.6Z",
  queue: "M21 16V4c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2Zm-2 0H7V4h12v12ZM3 6H1v14c0 1.1.9 2 2 2h14v-2H3V6Zm4 2h10v2H7V8Zm0 4h10v2H7v-2Zm0-8h10v2H7V4Z",
  cancel: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59Z",
  data_object: "M4 4h3v2H6v12h1v2H4V4Zm10 0h6v2h-6V4Zm-4 3h4v2h-4V7Zm0 4h4v2h-4v-2Zm0 4h4v2h-4v-2Zm-6 5h6v2H4v-2Zm10-2h6v2h-6v-2Z",
  content_copy: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z",
  download: "M5 20h14v-2H5v2ZM19 9h-4V3H9v6H5l7 7 7-7Z",
  description: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6Zm1 7V3.5L18.5 9H15ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Zm0-8h3v2H8V9Z",
  zoom_in: "M9 11h2v2h2v-2h2V9h-2V7h-2v2H9v2Zm3-9C6.48 2 2 6.48 2 12s4.48 10 10 10c1.98 0 3.82-.57 5.38-1.55L21.49 25.56 22.9 24.15l-4.11-4.11A9.96 9.96 0 0 0 22 12c0-5.52-4.48-10-10-10Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z",
  zoom_out: "M9 11h6V9H9v2Zm3-9C6.48 2 2 6.48 2 12s4.48 10 10 10c1.98 0 3.82-.57 5.38-1.55L21.49 25.56 22.9 24.15l-4.11-4.11A9.96 9.96 0 0 0 22 12c0-5.52-4.48-10-10-10Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z",
  light_mode: "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 2V1m0 22v-1m10-10h1M1 12h1m17.07-7.07.71-.71M4.22 19.78l.71-.71m0-14.14-.71-.71m15.56 15.56-.71-.71",
  dark_mode: "M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A7.97 7.97 0 0 1 12 19a7 7 0 0 1 0-14c.47 0 .93.04 1.36.1A9.1 9.1 0 0 0 12 3Z",
};

function Icon({ children }: { children: string }) {
  return (
    <svg className="material-symbols-outlined" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" focusable="false">
      <path d={ICON_PATHS[children] ?? ICON_PATHS.description} />
    </svg>
  );
}
function Header({ theme, onToggleTheme }: { theme: "dark" | "light"; onToggleTheme: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <h1>SriPage</h1>
          <p>v1.0.0-beta</p>
        </div>
        <div className="top-actions">
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "light"}
            onClick={onToggleTheme}
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb"><Icon>{theme === "dark" ? "dark_mode" : "light_mode"}</Icon></span>
            </span>
          </button>
          <button aria-label="Notifications">
            <Icon>notifications</Icon>
          </button>
          <button aria-label="Account">
            <Icon>account_circle</Icon>
          </button>
        </div>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer>
      <span>© 2026 SriPage. All rights reserved.</span>
      <div>
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Help Center</a>
      </div>
    </footer>
  );
}

function UploadScreen({
  jobs,
  file,
  setFile,
  method,
  setMethod,
  onUpload,
  busy,
  message,
}: {
  jobs: Job[];
  file: File | null;
  setFile: (file: File | null) => void;
  method: string;
  setMethod: (method: string) => void;
  onUpload: () => void;
  busy: boolean;
  message: string;
}) {
  const choose = (e: ChangeEvent<HTMLInputElement>) =>
    setFile(e.target.files?.[0] ?? null);
  const drop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setFile(e.dataTransfer.files?.[0] ?? null);
  };
  return (
    <>
      <main className="dashboard">
        <div className="intro">
          <p>Upload documents to begin parsing.</p>
        </div>
        <label
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={drop}
        >
          <input type="file" accept={ACCEPT} onChange={choose} />
          <div className="upload-circle">
            <Icon>file_upload</Icon>
          </div>
          <h2>{file ? file.name : "Drop documents here to parse"}</h2>
          <p>
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB ready`
              : "Supported formats: PDF, JPEG. Maximum file size: 50MB."}
          </p>
          <span className="browse-button">Browse Files</span>
        </label>
        <div className="metrics">
          <div className="metric">
            <div>
              <span>Total Parsed Today</span>
              <Icon>insert_drive_file</Icon>
            </div>
            <strong>{jobs.length ? jobs.length.toLocaleString() : "0"}</strong>
            <em>
              <Icon>trending_up</Icon> 12%
            </em>
          </div>
          <div className="metric">
            <div>
              <span>Avg Extraction Time</span>
              <Icon>timer</Icon>
            </div>
            <strong>1.4s</strong>
            <em>
              <Icon>trending_down</Icon> 0.2s
            </em>
          </div>
          <button
            className="start-button"
            disabled={!file || busy}
            onClick={onUpload}
          >
            {busy ? "Uploading…" : "Start parsing"}
            <Icon>arrow_forward</Icon>
          </button>
        </div>
        <details style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
          <summary
            style={{ cursor: "pointer", width: "fit-content", opacity: 0.7 }}
          >
            Parsing options
          </summary>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 8,
            }}
          >
            <label htmlFor="parsing-method">Method</label>
            <select
              id="parsing-method"
              style={{
                padding: "6px 26px 6px 8px",
                border: "1px solid var(--soft-line)",
                borderRadius: 4,
                background: "var(--container)",
                color: "var(--text)",
                font: "inherit",
                cursor: "pointer",
              }}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="non-vlm">Non-VLM</option>
              <option value="vlm">VLM</option>
            </select>
          </div>
        </details>
        {message && <p className="notice">{message}</p>}
      </main>
      <Footer />
    </>
  );
}

function LoadingScreen({ job, onCancel }: { job: Job; onCancel: () => void }) {
  return (
    <main className="loading-screen">
      <div className="progress-block">
        <div className="progress-ring">
          <svg viewBox="0 0 120 120">
            <circle className="ring-track" cx="60" cy="60" r="54" />
            <circle className="ring-progress" cx="60" cy="60" r="54" />
          </svg>
          <Icon>sync</Icon>
        </div>
        <div className="queue-pill">
          <span>
            <Icon>queue</Icon> Queue:{" "}
            <b>
              {job.status === "queued"
                ? `${job.queuePosition ?? 2} of 5`
                : "processing"}
            </b>
          </span>
          <span>
            <Icon>timer</Icon> Est: <b>30s</b>
          </span>
        </div>
      </div>
      <button className="cancel-button" onClick={onCancel}>
        <Icon>cancel</Icon> Cancel Parsing
      </button>
    </main>
  );
}

const demoResult = {
  document_id: "INV-2023-0891",
  extraction_confidence: 0.98,
  entities: {
    vendor: {
      name: "Acme Global Logistics",
      address: "123 Freight Way, Suite 400, Chicago, IL 60601",
      tax_id: "US-99-887766",
    },
    invoice_details: {
      invoice_number: "AGL-55409",
      date: "2023-10-15",
      due_date: "2023-11-14",
      currency: "USD",
    },
    line_items: [
      {
        description: "Ocean Freight - Shanghai to LAX",
        quantity: 1,
        unit_price: 4500,
        total: 4500,
      },
      {
        description: "Customs Clearance Fee",
        quantity: 1,
        unit_price: 250,
        total: 250,
      },
    ],
    totals: { subtotal: 4750, tax: 0, grand_total: 4750 },
  },
};
function ResultScreen({ job }: { job: Job }) {
  const payload =
    job.result && typeof job.result === "object" ? job.result : demoResult;
  const pretty = JSON.stringify(payload, null, 2);
  const copy = () => void navigator.clipboard?.writeText(pretty);
  const exportJson = () => {
    const blob = new Blob([pretty], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="result-screen">
      <section className="result-card mt-24">
        <div className="card-heading">
          <div>
            <Icon>data_object</Icon>
            <h2>Extracted Payload</h2>
          </div>
          <div className="card-actions">
            <button onClick={copy}>
              <Icon>content_copy</Icon> Copy JSON
            </button>
            <button className="export-button" onClick={exportJson}>
              <Icon>download</Icon> Export
            </button>
          </div>
        </div>
        <pre>{pretty}</pre>
      </section>
      <section className="result-card source-card mt-24">
        <div className="card-heading">
          <div>
            <Icon>description</Icon>
            <h2>Source Document</h2>
            <span>Page 1 of 1</span>
          </div>
          <div className="card-actions icon-actions">
            <button aria-label="Zoom in">
              <Icon>zoom_in</Icon>
            </button>
            <button aria-label="Zoom out">
              <Icon>zoom_out</Icon>
            </button>
          </div>
        </div>
        <div className="document-area">
          <div className="document">
            <div className="doc-brand">
              ACME GLOBAL
              <br />
              <small>LOGISTICS</small>
            </div>
            <div className="doc-title">INVOICE</div>
            <div className="doc-rule" />
            <div className="doc-lines">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="doc-table">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="doc-total">TOTAL&nbsp;&nbsp; $4,750.00</div>
            <div className="bounding-box vendor-box" />
            <div className="bounding-box date-box" />
            <div className="bounding-box total-box" />
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]),
    [file, setFile] = useState<File | null>(null),
    [method, setMethod] = useState("non-vlm"),
    [selected, setSelected] = useState<Job | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem("sripage-theme", nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  const loadJobs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/jobs`, { cache: "no-store" });
      if (r.ok) setJobs(await r.json());
    } catch {
      /* API can be offline while UI is previewed. */
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void loadJobs(), 0);
    return () => clearTimeout(t);
  }, [loadJobs]);
  useEffect(() => {
    if (!jobs.some((j) => j.status === "queued" || j.status === "processing"))
      return;
    const t = setInterval(() => void loadJobs(), 2000);
    return () => clearInterval(t);
  }, [jobs, loadJobs]);
  const active = useMemo(
    () =>
      selected ? (jobs.find((j) => j.id === selected.id) ?? selected) : null,
    [jobs, selected],
  );
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const p = await fetch(`${API}/uploads/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      }).then((r) => r.json());
      const put = await fetch(p.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw Error("Upload failed");
      const job = await fetch(`${API}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          inputObjectKey: p.objectKey,
          method,
        }),
      }).then((r) => r.json());
      setJobs((c) => [job, ...c]);
      setSelected(job);
      setFile(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  const screen =
    active?.status === "completed" ? (
      <ResultScreen job={active} />
    ) : active ? (
      <LoadingScreen job={active} onCancel={() => setSelected(null)} />
    ) : (
      <UploadScreen
        jobs={jobs}
        file={file}
        setFile={setFile}
        method={method}
        setMethod={setMethod}
        onUpload={() => void upload()}
        busy={busy}
        message={message}
      />
    );
  return (
    <>
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {screen}
    </>
  );
}
