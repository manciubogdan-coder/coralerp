const path = require("path");
const { Service } = require("node-windows");
const svc = new Service({
  name: "Senior ERP Mirror",
  description: "Oglindire completa read-only Senior ERP -> Coral ERP",
  script: path.join(__dirname, "..", "src", "index.js"),
  workingDirectory: path.join(__dirname, ".."),
});
svc.on("install", () => { console.log("✅ Serviciu instalat. Pornire..."); svc.start(); });
svc.on("error", (e) => console.error("❌", e));
svc.install();
