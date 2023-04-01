import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { Box, Drawer, useTheme } from "@mui/material";
import CSVConfigurationPane from "@src/components/csvConfiguration/CSVConfigurationPane";
import { colFromNumber, checkBoundaries } from "@src/utils";
import { Row, SelectedData, emptySelection } from "@src/interfaces";
import { MIN_ROW_COUNT } from "@src/constants";
import { HotTable } from "./HotTable";

interface ComponentProps {
  file: File;
  setLoadedXML: (string) => void;
}

/**
 * The main screen for the CSVConfiguration page, holding the table and configuration pane
 *
 * @param {ComponentProps} props - the required props
 * @returns {JSX.Element} - the returned component
 */
export default function CSVConfiguration(props: ComponentProps): JSX.Element {
  const theme = useTheme();
  const drawerWidth = theme.spacing(50);

  const [rows, setRows] = useState<Row[]>([]);
  const [selection, setSelection] = useState<SelectedData>(emptySelection);
  const [multipleSelection, setMultipleSelection] = useState(false);

  useEffect(() => {
    Papa.parse(props.file, {
      header: false,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Row>) => {
        const fileData = results.data;

        const tempArr: string[][] = [
          ...Array(Math.max(fileData.length, MIN_ROW_COUNT)),
        ].map(() => Array(results.data[0].length).fill(""));
        for (const row in fileData) {
          for (const col in fileData[row]) {
            tempArr[row][col] = fileData[row][col];
          }
        }
        setRows(tempArr);
      },
    });
  }, [props.file]);

  const onAfterSelectionEnd = (
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ) => {
    startRow = checkBoundaries(startRow, rows.length - 1);
    endRow = checkBoundaries(endRow, rows.length - 1);
    startCol = checkBoundaries(startCol, rows[0].length - 1);
    endCol = checkBoundaries(endCol, rows[0].length - 1);

    setSelection({
      data: rows.slice(startRow, endRow + 1).map((row) => {
        return row.slice(startCol, endCol + 1);
      }),
      startRow: startRow,
      startCol: startCol,
      endRow: endRow,
      endCol: endCol,
    });
  };

  return (
    <>
      <Box sx={{ display: "block", height: "100vh", width: "100vw" }}>
        <Box
          component="main"
          id={"hot-table-box"}
          sx={{
            display: "block",
            height: "100%",
            width: `calc(100% - ${drawerWidth})`,
          }}
        >
          <HotTable
            data={rows}
            colHeaders={(index: number) => {
              return colFromNumber(index);
            }}
            editor={false}
            rowHeaders={true}
            height="100%"
            width="100%"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            minRows={MIN_ROW_COUNT}
            selectionMode={multipleSelection ? "range" : "single"}
            afterSelectionEnd={onAfterSelectionEnd}
            outsideClickDeselects={false}
            afterChange={(changes) => {
              // eslint-disable-next-line
              changes?.forEach(([row, col, _, newValue]) => {
                const copy = JSON.parse(JSON.stringify(rows));
                copy[row][col] = newValue;
                setRows(copy);
              });
            }}
          />
        </Box>
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
          variant="permanent"
          anchor="right"
        >
          <CSVConfigurationPane
            selection={selection}
            multipleSelection={multipleSelection}
            setMultipleSelection={setMultipleSelection}
            setLoadedXML={props.setLoadedXML}
          />
        </Drawer>
      </Box>
    </>
  );
}
