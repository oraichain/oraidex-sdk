import { Bar as BarType } from "../charting_library";

export type Bar = BarType & {
  ticker?: string;
};
