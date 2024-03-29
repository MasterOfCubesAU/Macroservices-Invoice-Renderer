export type AppErrorArgs = {
  message?: string;
};

export type RenderArgs = {
  language: string;
  style: number;
  ubl: string;
  optional?: {
    icon?: string;
  };
};

export type RouteRenderArgs = {
  language?: string;
  style?: string;
  ubl?: string;
  optional?: {
    icon?: string;
  };
};

export type JSONValue =
  | string
  | number
  | boolean
  | { [x: string]: JSONValue }
  | Array<JSONValue>;

export type PeriodType = {
  startDate?: string;
  endDate?: string;
};
