
import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, FileSpreadsheet, Download } from "lucide-react";
import * as XLSX from "xlsx";

const COLUMN_DEFS = [
  { key: "ingredient_nume", label: "Ingredient" },
  { key: "cantitate_consumata", label: "Consumat (kg)" },
  { key: "cantitate_necesara_pending", label: "Necesar Pending (kg)" },
  { key: "cantitate_totala", label: "Total (kg)" },
  { key: "comenzi_finalizate", label: "Comenzi Finalizate" },
  { key: "comenzi_pending", label: "Comenzi Pending" },
  { key: "produse_list", label: "Produse" }
];

interface Props {
  consumptionData: any[];
  fileName: string;
}

const ExportConsumptionDialog: React.FC<Props> = ({ consumptionData, fileName }) => {
  const [open, setOpen] = useState(false);
  const [selectedCols, setSelectedCols] = useState(COLUMN_DEFS.map(col => col.key));
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("xlsx");

  const toggleCol = (key: string) => {
    setSelectedCols(cols =>
      cols.includes(key) ? cols.filter(col => col !== key) : [...cols, key]
    );
  };

  const exportData = () => {
    const dataToExport = consumptionData.map(item =>
      selectedCols.reduce((acc, key) => ({ ...acc, [key]: item[key] }), {})
    );
    const header = COLUMN_DEFS.filter(col => selectedCols.includes(col.key)).map(col => col.label);

    if (exportFormat === "csv") {
      const csv = [
        header.join(","),
        ...dataToExport.map(row =>
          COLUMN_DEFS.filter(col => selectedCols.includes(col.key))
            .map(col => {
              // Formatăm valorile în kg cu 2 zecimale
              if (
                ["cantitate_consumata", "cantitate_necesara_pending", "cantitate_totala"].includes(col.key)
              ) {
                return typeof row[col.key] === "number"
                  ? row[col.key].toFixed(2)
                  : row[col.key] || "";
              }
              return typeof row[col.key] === "string" ? `"${row[col.key]}"` : row[col.key] ?? "";
            })
            .join(",")
        )
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName + ".csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const ws_data = [header].concat(
        dataToExport.map(row => 
          COLUMN_DEFS.filter(col => selectedCols.includes(col.key)).map(col => {
            if (
              ["cantitate_consumata", "cantitate_necesara_pending", "cantitate_totala"].includes(col.key)
            ) {
              return typeof row[col.key] === "number"
                ? row[col.key].toFixed(2)
                : row[col.key] || "";
            }
            return row[col.key];
          })
        )
      );
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consumuri");
      XLSX.writeFile(wb, fileName + ".xlsx");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Consumuri Materie Primă</DialogTitle>
          <DialogDescription>
            Alege coloanele pe care vrei să le exporți și formatul fișierului.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="font-semibold mb-2">Coloane:</div>
            <div className="grid grid-cols-2 gap-2">
              {COLUMN_DEFS.map(col => (
                <label className="flex items-center gap-2" key={col.key}>
                  <Checkbox
                    checked={selectedCols.includes(col.key)}
                    onCheckedChange={() => toggleCol(col.key)}
                  /> {col.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Format fișier:</div>
            <div className="flex items-center gap-4">
              <button
                className={`flex items-center gap-1 px-2 py-1 border rounded ${
                  exportFormat === "xlsx"
                    ? "border-green-600 text-green-700 font-bold"
                    : "border-gray-300"
                }`}
                onClick={() => setExportFormat("xlsx")}
                type="button"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel (.xlsx)
              </button>
              <button
                className={`flex items-center gap-1 px-2 py-1 border rounded ${
                  exportFormat === "csv"
                    ? "border-blue-600 text-blue-700 font-bold"
                    : "border-gray-300"
                }`}
                onClick={() => setExportFormat("csv")}
                type="button"
              >
                <FileText className="h-4 w-4" />
                CSV
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={exportData} disabled={selectedCols.length === 0}>
            Exportă
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportConsumptionDialog;
