import React, { useContext } from "react";
import RPDF from "@react-pdf/renderer";

import { renderingContext, RenderingContexts } from "./renderingContext";
import { styleContext, extraStyles } from "@src/react/styles";
import { PAGE_SIZES } from "@src/constants";

const Page = (props) => {
  const renderType = useContext(renderingContext);
  const userStyle = extraStyles[useContext(styleContext)];

  if (renderType === RenderingContexts.Pdf) {
    return <RPDF.Page size={props.size}>{props.children}</RPDF.Page>;
  } else {
    return (
      <body
        style={{
          margin: "auto",
          width: PAGE_SIZES[userStyle["meta"].pageSize].INNER_WIDTH,
        }}
      >
        {props.children}
      </body>
    );
  }
};

export default Page;