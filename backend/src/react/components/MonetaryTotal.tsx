import React from "react";

import { JSONValue } from "@src/interfaces";
import { styles } from "../styles";
import { formatCurrency } from "@src/util";
import { useTranslation } from "react-i18next";
import { i18n } from "i18next";

import View from "./base/View";
import Text from "./base/Text";

const renderOrder = [
  ["LineExtensionAmount", "Subtotal (items)"],
  ["AllowanceTotalAmount", "Total discount"],
  ["ChargeTotalAmount", "Total additional charges"],
  ["TaxExclusiveAmount", "Subtotal (before tax)"],
  ["TaxInclusiveAmount", "Subtotal (after tax)"],
  ["PrepaidAmount", "Credit"],
  ["PayableRoundingAmount", "Rounding"],
  ["PayableAmount", "Payable amount"],
];

export const MonetaryTotal = (props: {
  legalMonetaryTotal: JSONValue;
  i18next: i18n;
}) => {
  const totals = props.legalMonetaryTotal;

  if (!totals["AllowanceTotalAmount"] && !totals["ChargeTotalAmount"]) {
    delete totals["LineExtensionAmount"];
  }
  const { t: translateHook } = useTranslation();

  return (
    <View style={[styles.tableWrapper_borderless, styles.totalTable]}>
      {renderOrder
        .filter((item) => item[0] in (totals as Object))
        .map((item, i) => (
          <View
            style={[
              styles.row_borderless,
              item[0] === "PayableAmount"
                ? { borderTop: 2, borderColor: "black", marginTop: 8 }
                : {},
            ]}
            key={i}
          >
            <Text
              style={[
                styles.col_borderless,
                { width: "60%", padding: 2 },
                item[0] === "PayableAmount" ? styles.big : {},
              ]}
            >
              {translateHook(item[1])}:
            </Text>
            <Text
              style={[
                styles.col_borderless,
                { width: "40%", textAlign: "right", padding: 2 },
                item[0] === "PayableAmount" ? styles.big : {},
              ]}
            >
              {formatCurrency(totals[item[0]])}
            </Text>
          </View>
        ))}
    </View>
  );
};
