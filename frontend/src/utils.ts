import {
  InvoiceItem,
  InvoiceMetadata,
  InvoiceParty,
  InvoiceAddress,
} from "./interfaces";
import xml from "xml";
import { invoiceOptions } from "./components/CSVConfiguration/CSVConfigurationFields";
import {
  INVOICE_ITEMS,
  ABN_ID,
  DEF_UNIT,
  GST_RATE,
  INVOICE_CODE,
  MAX_IDS,
  INVOICE_DURATION,
  MAX_ID_LENGTH,
  DEFAULT_CURRENCY,
  DEFAULT_REFERENCE,
  DEFAULT_COUNTRY,
} from "./constants";
import { Api } from "./Api";
import currencyMap from "currency-symbol-map";
import { parse, compareAsc, addDays } from "date-fns";
import { Session } from "next-auth";

/**
 * Prompts the user to upload a file
 *
 * @param {string} fileType - file type to upload (eg ".csv")
 * @returns {Promise<File>} - uploaded file
 */
export async function uploadFile(fileType: string): Promise<File> {
  return new Promise((res, rej) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = fileType;

    input.onchange = async (e) => {
      if (!e || !e.target) {
        return rej("Something went wrong. Please try again.");
      }
      const target = e.target as HTMLInputElement;
      if (!target.files) {
        return rej("Something went wrong. Please try again.");
      }

      const file = target.files[0];

      if (fileType === ".csv" && !file.name.match(/(^[\w.]+)?\.csv$/)) {
        return rej("Please upload a valid .csv file.");
      } else if (fileType === ".xml") {
        if (!file.name.match(/(^[\w.]+)?\.xml$/)) {
          return rej("Please upload a valid .xml file.");
        }
        const bytes = await file.arrayBuffer();
        const checkUBL = await Api.renderToJSON(Buffer.from(bytes).toString());

        if (checkUBL.status === 422) {
          return rej(
            "The uploaded file does not follow the A-NZ-PEPPOL-BIS-3.0 specification."
          );
        } else if (checkUBL.status !== 200) {
          return rej(
            "Something went wrong on our end. Please try again later."
          );
        }
      }

      res(file);
    };

    input.click();
  });
}

/**
 * Downloads a file on the client
 * @param data - data to download within file
 * @param fname - file name
 */
export function downloadFile(data: Blob, fname: string) {
  const a = document.createElement("a");

  const url = URL.createObjectURL(data);

  a.href = url;
  a.download = fname;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Reads a file to text
 *
 * @param {File} file - file to read
 * @returns {Promise<string>} - string that is read
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      if (!evt.target) return;
      if (evt.target.readyState !== 2) return;
      if (evt.target.error) {
        rej(evt.target.error);
        return;
      }

      res(evt.target.result as string);
    };

    reader.readAsText(file);
  });
}

/**
 * Takes potentially sparse, structured data and converts it into a UBL compliant
 * XML string. Missing compulsory data is filled by reasonable defaults.
 *
 * @param {InvoiceItem[]} items - a list of items to include
 * @param {InvoiceMetadata} meta - invoice-level metadata to include
 * @param {InvoiceParty} supplier - details about the party supplying the goods/service
 * @param {InvoiceParty} customer - details about the party receiving the goods/service
 * @returns {string} - an XML string with the supplied data
 */
export function generateXML(
  items: InvoiceItem[],
  meta: InvoiceMetadata,
  supplier: InvoiceParty,
  customer: InvoiceParty
): string {
  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;

  meta.currencyCode ||= DEFAULT_CURRENCY;
  const today = new Date();
  const defaultDue = new Date();
  defaultDue.setDate(today.getDate() + INVOICE_DURATION);
  meta.issueDate ||= formatDate(today);
  meta.dueDate ||= formatDate(defaultDue);
  meta.reference ||= DEFAULT_REFERENCE;
  meta.id ||= `${Math.floor(Math.random() * MAX_IDS)}`.padStart(
    MAX_ID_LENGTH,
    "0"
  );
  supplier.address ||= {};
  customer.address ||= {};
  supplier.address.country ||= DEFAULT_COUNTRY;
  customer.address.country ||= DEFAULT_COUNTRY;

  if (meta.delivery) {
    if (meta.delivery.address === undefined) {
      meta.delivery.address = { ...customer.address };
    }
    meta.delivery.address.country ||= DEFAULT_COUNTRY;
  }

  const formatCurrency = (amt: number) => [
    amt,
    { "_attr": { "currencyID": meta.currencyCode } },
  ];

  const formatABN = (abn: string) => [abn, { "_attr": { "schemeID": ABN_ID } }];

  const formatAddress = (address?: InvoiceAddress) =>
    address
      ? [
          { "cbc:StreetName": address.streetAddress },
          { "cbc:AdditionalStreetName": address.extraLine },
          { "cbc:CityName": address.suburb },
          { "cbc:PostalZone": address.postcode },
          { "cbc:CountrySubentity": address.state },
          { "cac:Country": [{ "cbc:IdentificationCode": address.country }] },
        ]
      : {};

  const formatParty = (party?: InvoiceParty) =>
    party
      ? [
          {
            "cac:Party": [
              { "cbc:EndpointID": formatABN(party.abn) },
              { "cac:PartyName": [{ "cbc:Name": party.name }] },
              { "cac:PostalAddress": formatAddress(party.address) },
              {
                "cac:PartyLegalEntity": [
                  { "cbc:RegistrationName": party.name },
                  { "cbc:CompanyID": formatABN(party.abn) },
                ],
              },
              {
                "cac:Contact": [
                  { "cbc:Name": party.contactName },
                  { "cbc:Telephone": party.contactPhone },
                  { "cbc:ElectronicMail": party.contactEmail },
                ],
              },
            ],
          },
        ]
      : {};

  const round2dp = (num: number) => Math.round(num * 100) / 100;

  const clean = (obj: object | string | number) => {
    if (typeof obj !== "object") return true;
    const keys = Object.keys(obj);
    if (keys.length !== 1) return false;
    const contents = obj[keys[0]];
    if (!Array.isArray(contents)) return contents !== undefined;
    else {
      obj[keys[0]] = contents.filter((x) => clean(x));
      return obj[keys[0]].length > 0;
    }
  };

  // https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript
  // This next line is not a linting error.
  // eslint-disable-next-line no-unused-vars
  const check = <T>(obj: T, result: (obj: T) => object) =>
    typeof obj === "object" && !Array.isArray(obj) && obj !== null
      ? result(obj)
      : {};

  const preTaxTotal = items.reduce((p, n) => p + n.qty * n.unitPrice, 0);
  const taxAmount = round2dp(preTaxTotal * GST_RATE);
  const totalAmount = round2dp(preTaxTotal * (1 + GST_RATE));

  const xmlObject = [
    {
      "Invoice": [
        {
          "_attr": {
            "xmlns:cac":
              "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
            "xmlns:cbc":
              "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
            "xmlns": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
          },
        },
        {
          "cbc:CustomizationID":
            "urn:cen.eu:en16931:2017#conformant#urn:fdc:peppol.eu:2017:poacc:billing:international:aunz:3.0",
        },
        { "cbc:ProfileID": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0" },
        { "cbc:ID": meta.id },
        { "cbc:IssueDate": meta.issueDate },
        { "cbc:DueDate": meta.dueDate },
        { "cbc:InvoiceTypeCode": INVOICE_CODE },
        { "cbc:Note": meta.note },
        { "cbc:DocumentCurrencyCode": meta.currencyCode },
        { "cbc:BuyerReference": meta.reference },
        {
          "cac:InvoicePeriod": [
            { "cbc:StartDate": meta.startDate },
            { "cbc:EndDate": meta.endDate },
          ],
        },
        { "cac:AccountingSupplierParty": formatParty(supplier) },
        { "cac:AccountingCustomerParty": formatParty(customer) },
        check(meta.delivery, (x) => ({
          "cac:Delivery": [
            { "cbc:ActualDeliveryDate": x.deliveryDate },
            {
              "cac:DeliveryLocation": [
                { "cac:Address": formatAddress(x.address) },
              ],
            },
            {
              "cac:DeliveryParty": [
                { "cac:PartyName": [{ "cbc:Name": x.name }] },
              ],
            },
          ],
        })),
        {
          "cac:TaxTotal": [
            { "cbc:TaxAmount": formatCurrency(taxAmount) },
            {
              "cac:TaxSubtotal": [
                { "cbc:TaxableAmount": formatCurrency(preTaxTotal) },
                { "cbc:TaxAmount": formatCurrency(taxAmount) },
                {
                  "cac:TaxCategory": [
                    { "cbc:ID": "S" },
                    { "cbc:Percent": GST_RATE * 100 },
                    { "cac:TaxScheme": [{ "cbc:ID": "GST" }] },
                  ],
                },
              ],
            },
          ],
        },
        {
          "cac:LegalMonetaryTotal": [
            { "cbc:LineExtensionAmount": formatCurrency(preTaxTotal) },
            { "cbc:TaxExclusiveAmount": formatCurrency(preTaxTotal) },
            { "cbc:TaxInclusiveAmount": formatCurrency(totalAmount) },
            { "cbc:PayableAmount": formatCurrency(totalAmount) },
          ],
        },
        ...items.map((item, i) => ({
          "cac:InvoiceLine": [
            { "cbc:ID": i },
            {
              "cbc:InvoicedQuantity": [
                item.qty,
                { "_attr": { "unitCode": DEF_UNIT } },
              ],
            },
            {
              "cbc:LineExtensionAmount": formatCurrency(
                round2dp(item.unitPrice * item.qty)
              ),
            },
            { "cbc:AccountingCost": item.code },
            {
              "cac:InvoicePeriod": [
                { "cbc:StartDate": item.startDate },
                { "cbc:EndDate": item.endDate },
              ],
            },
            {
              "cac:Item": [
                { "cbc:Description": item.description },
                { "cbc:Name": item.name },
                {
                  "cac:BuyersItemIdentification": [
                    {
                      "cbc:ID": item.buyerId,
                    },
                  ],
                },
                {
                  "cac:SellersItemIdentification": [
                    {
                      "cbc:ID": item.sellerId,
                    },
                  ],
                },
                {
                  "cac:ClassifiedTaxCategory": [
                    { "cbc:ID": "S" },
                    { "cbc:Percent": GST_RATE * 100 },
                    { "cac:TaxScheme": [{ "cbc:ID": "GST" }] },
                  ],
                },
              ],
            },
            {
              "cac:Price": [
                {
                  "cbc:PriceAmount": formatCurrency(item.unitPrice),
                },
              ],
            },
          ],
        })),
      ],
    },
  ];

  clean(xmlObject[0]);

  return xml(xmlObject, true);
}

/**
 * Returns the corresponding spreadsheet column name based on an inputted number
 * Code retrieved from https://stackoverflow.com/questions/8240637/convert-numbers-to-letters-beyond-the-26-character-alphabet
 * Written by Christopher Young
 *
 * @param {number} num - the number to convert
 * @returns {string} - the returned letter
 */
export function colFromNumber(num: number): string {
  const m = num % 26;
  const c = String.fromCharCode(65 + m);
  const r = num - m;
  return r > 0 ? `${colFromNumber((r - 1) / 26)}${c}` : c;
}

/**
 * Returns the column number from a corresponding spreadsheet column name
 * Code retrieved from https://stackoverflow.com/questions/9905533/convert-excel-column-alphabet-e-g-aa-to-number-e-g-25
 * Written by cuixiping
 *
 * @param {string} colName - the string to convert
 * @returns {number} - the returned column, returns 0 if there is no string
 */
export function lettersToNumber(colName: string): number {
  if (colName.length === 0) return 0;
  return colName.split("").reduce((r, a) => r * 26 + parseInt(a, 36) - 9, 0);
}

/**
 * Returns the cell range reference given cell range coordinates
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 * @returns {string} - the cell range reference
 */
export function convertToCellRefs(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): string {
  if (startRow === -1 || startCol === -1 || endRow === -1 || endCol === -1)
    return "";
  return `${colFromNumber(startCol)}${startRow + 1}:${colFromNumber(endCol)}${
    endRow + 1
  }`;
}

/**
 * Given an index, check if it is out of bound. It will return the max index if it exceeds the max
 * index, 0 if lower than 0, otherwise returns the original index.
 *
 * @param {number} index - the index to check
 * @param {number} maxIndex - the greatest index of the array
 * @returns {number} - the result
 */
export function checkBoundaries(index: number, maxIndex: number): number {
  if (index < 0) return 0;
  if (index > maxIndex) return maxIndex;
  return index;
}

/**
 * Takes the invoice options data structure and reduces it
 * to contain only the IDs of the text fields, and an empty
 * value for a text state.
 * @returns {Record<string, string>} - the new object
 */
export function createTextStateObject(): Record<string, string> {
  const tempItems: string[][] = [];

  invoiceOptions.forEach((category) => {
    category.items.forEach((item) => {
      if (category.id === "invoice_parties") {
        tempItems.push([`from_${item.id}`, ""], [`to_${item.id}`, ""]);
      } else {
        tempItems.push([item.id, ""]);
      }
    });
  });

  return Object.fromEntries(tempItems);
}

/**
 * Returns all the IDs of the item fields with blank values for resetting
 *
 * @returns {string[][]} - all the IDs
 */
export function getInvoiceItemIDs(): string[][] {
  return invoiceOptions[INVOICE_ITEMS].items.map((item) => {
    return [item.id, ""];
  });
}

/**
 * Returns all the IDs of the item fields that will cause another field to be required
 * @param {string} field - the field to check
 * @param {number} category - the category to pull data from
 * @returns {string[]} - all the IDs
 */
export function getDependentRequiredFields(
  field: string,
  category: number
): string[] {
  const res: string[] = [];
  invoiceOptions[category].items.forEach((item) => {
    if (item.dependent === field) {
      res.push(item.id);
    }
  });

  return res;
}

/**
 * Given a string, it extracts any dollar signs, and checks if the string is a number
 *
 * @param {string} input - the string to return a number from
 * @returns {number} - returns 0 if not a number, otherwise returns the number
 */
export function extractNumber(input: string): number {
  if (!input || input.length === 0) return 0;
  const tmp = Number(input.replace("$", ""));
  return isNaN(tmp) ? 0 : tmp;
}

// Code to read a file as a base64 encoded string
// https://stackoverflow.com/questions/36280818/how-to-convert-file-to-base64-in-javascript
export const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

/**
 * Given a currency object, returns a human readable formatted string.
 * @param {object} currencyObject  - A currency object
 * @returns {str} - The formatted string (e.g "$10.10", "-$87.21")
 */
export function formatCurrency(currencyObject) {
  let result = "";

  if (currencyObject["_text"] < 0) result = "-";

  let foundCurrency = false;
  const value = Math.abs(currencyObject["_text"]).toFixed(2);

  if (isNaN(Number(value))) {
    return "N/A";
  }

  if (currencyMap(currencyObject["$currencyID"])) {
    foundCurrency = true;
    result += currencyMap(currencyObject["$currencyID"]);
  }

  result += `${value}${
    foundCurrency ? "" : ` ${currencyObject["$currencyID"]}`
  }`;
  return result;
}

export const compareDate = (date, offset) =>
  compareAsc(
    parse(date, "yyyy-MM-dd", new Date()),
    addDays(Date.now(), offset)
  );

/**
 * Takes a string and converts it to a colour
 *
 * @param {string} string - the string to convert
 * @returns {string} - the hexcode of the colour
 */
function stringToColor(string: string): string {
  let hash = 0;

  /* eslint-disable no-bitwise */
  for (let i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = "#";

  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */

  return color;
}

/**
 * Given valid session data, return either the profile picture or a picture with their initials
 * and a background colour determined by their name
 *
 * @param {Session["user"]} user
 * @returns {object} - props and children for the Avatar component
 */
export function stringAvatar(user: Session["user"]): object {
  if (!user) return {};
  const { name, image } = user;

  return {
    sx: {
      bgcolor: stringToColor(name),
    },
    children: image
      ? undefined
      : `${name.split(" ")[0][0].toUpperCase()}${
          name.split(" ").length <= 1 ? "" : name.split(" ")[1][0].toUpperCase()
        }`,
    src: image ? image : undefined,
  };
}
