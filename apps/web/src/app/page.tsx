export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1.25rem" }}>
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12 }}>
        Mouse Parts Lookup
      </p>
      <h1 style={{ fontSize: "2rem", lineHeight: 1.2 }}>API is live. Website comes after the extension.</h1>
      <p style={{ color: "#444", lineHeight: 1.6 }}>
        This Vercel app currently serves the extension API. A desktop search experience will be
        built here once the Chrome extension MVP is done.
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <code>GET /api/health</code>
        </li>
        <li>
          <code>GET /api/search?q=pulsefire</code>
        </li>
        <li>
          <code>GET /api/models/:id</code>
        </li>
        <li>
          <code>POST /api/votes</code>
        </li>
      </ul>
    </main>
  );
}
