// Instalează bridge-ul ca serviciu Windows (pornește automat cu PC-ul).
// Necesită să fii rulat ca Administrator.
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "Senior ERP Bridge",
  description: "Sincronizează avize Senior ERP → Coral ERP",
  script: path.join(__dirname, "..", "src", "index.js"),
  nodeOptions: [],
  workingDirectory: path.join(__dirname, ".."),
});

svc.on("install", () => {
  console.log("✅ Serviciu instalat. Pornire...");
  svc.start();
});
svc.on("start", () => console.log("✅ Serviciul rulează."));
svc.on("error", (e) => console.error("❌", e));
svc.install();
