const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "Senior ERP Bridge",
  script: path.join(__dirname, "..", "src", "index.js"),
});
svc.on("uninstall", () => console.log("✅ Serviciu dezinstalat."));
svc.uninstall();
