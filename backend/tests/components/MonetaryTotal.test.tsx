/**
 * @jest-environment jsdom
 */

import "./jest-setup";

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import testObject from "@tests/resources/example1.json";
import { MonetaryTotal } from "@src/react/components/MonetaryTotal";
import i18next from "@tests/components/i18nTest";

describe("Tax section component", () => {
  test("It should list the amount before tax and the payable amount", () => {
    render(
      <MonetaryTotal
        legalMonetaryTotal={testObject.LegalMonetaryTotal}
        i18next={i18next}
      />
    );

    const textFields = ["$100.00 AUD", "$110.00 AUD"];
    textFields.forEach((text) =>
      expect(screen.getAllByText(text)).toBeTruthy()
    );
  });
});
