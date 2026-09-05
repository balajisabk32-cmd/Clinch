const express = require("express");
const cors = require("cors");

const path = require("path");

const reportsRouter = require("./src/routes/reports");
const dataRouter = require("./src/routes/data");
const adminRouter = require("./src/routes/admin");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, "public"), { index: false }));

app.get("/", (req, res) => {
  // If requested by a web browser, serve the dashboard UI
  if (req.headers.accept && req.headers.accept.includes("text/html")) {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  }

  // Otherwise return standard API root JSON
  res.json({
    service: "Clinch Reporting & Dashboard Data Backend",
    owner: "Prabanjan",
    status: "ok",
    endpoints: {
      reports: [
        "GET /api/reports/deal-health-summary",
        "GET /api/reports/stalled-deals",
        "GET /api/reports/at-risk-deals",
        "GET /api/reports/sales-rep-discount-history",
        "GET /api/reports/deal-status-distribution",
        "GET /api/reports/dashboard",
      ],
      seedData: [
        "GET /api/customers",
        "GET /api/sales-reps",
        "GET /api/products",
        "GET /api/warehouses",
        "GET /api/deals",
        "GET /api/deals/:id",
      ],
      admin: ["POST /api/admin/reset-seed"],
    },
    docs: "See /docs/API.md, /docs/DEMO_SCRIPT.md, /docs/ARCHITECTURE.md",
  });
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use("/api/reports", reportsRouter);
app.use("/api", dataRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Clinch reporting backend listening on http://localhost:${PORT}`);
});
