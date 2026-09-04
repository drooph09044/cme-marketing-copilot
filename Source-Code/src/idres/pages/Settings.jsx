export default function Settings() {
  return (
    <div style={{ padding: "40px 32px" }}>
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "3px 10px",
          }}
        >
          Work in Progress
        </span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "12px 0 8px", color: "var(--text-primary)" }}>
        Settings
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
        Platform configuration and preferences will be available here.
      </p>
    </div>
  );
}
