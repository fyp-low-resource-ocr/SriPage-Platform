"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
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

function Icon({ children }: { children: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {children}
    </span>
  );
}
function Header() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <h1>SriPage</h1>
          <p>v1.0.0-beta</p>
        </div>
        <div className="top-actions">
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
      <span>© 2024 SriPage. All rights reserved.</span>
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
            <Icon>cloud_upload</Icon>
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
                border: "1px solid #ffffff1a",
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
      <section className="result-card">
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
      <section className="result-card source-card">
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
      <Header />
      {screen}
    </>
  );
}
