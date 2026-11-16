import { describe, expect, it } from "vitest";
import { groupTransferParts, splitReturn } from "@/lib/transferGroups";

const row = (o: Partial<any>) => ({
  transfer_id: "t1", inventory_item_id: "a", product_name: "Spanac Mare", lot_number: "4606",
  supplier_name: "S", manufacturer_name: "M", document_number: "569/A", unit: "kg", quantity: 0, net_quantity: 0, ...o,
});

describe("bon de transfer: un lot = un rând", () => {
  it("unește intrările aceluiași lot scoase pe același bon (219 + 381,5 = 600,5 kg)", () => {
    const g = groupTransferParts([
      row({ inventory_item_id: "a", quantity: 219, net_quantity: 219 }),
      row({ inventory_item_id: "b", quantity: 381.5, net_quantity: 381.5 }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].quantity).toBe(600.5);
    expect(g[0].net_quantity).toBe(600.5);
    expect(g[0].parts).toHaveLength(2);
  });

  it("nu unește loturi diferite sau bonuri diferite", () => {
    const g = groupTransferParts([
      row({ lot_number: "4606", quantity: 522 }),
      row({ lot_number: "4604", quantity: 176 }),
      row({ transfer_id: "t2", quantity: 10 }),
    ]);
    expect(g).toHaveLength(3);
  });

  it("returul se ia întâi din intrarea scoasă ultima", () => {
    const parts = [row({ inventory_item_id: "old", net_quantity: 219 }), row({ inventory_item_id: "new", net_quantity: 381.5 })];
    expect(splitReturn(parts, 400).map((s) => [s.part.inventory_item_id, s.qty])).toEqual([["new", 381.5], ["old", 18.5]]);
  });
});
