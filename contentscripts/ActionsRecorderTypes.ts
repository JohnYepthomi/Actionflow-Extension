export type RuntimeRequest = {
  message: string;
};

export type ActionEventTypes =
  | "Common"
  | "Click"
  | "Scroll"
  | "Keypress"
  | "Type"
  | "Hover"
  | "Select"
  | "Date"
  | "Upload"
  | "Code"
  | "Prompts";

export type ActionClickProp = {
  "Wait For New Page To load": boolean;
  "Wait For File Download": boolean;
  Description: string;
};

export type ActionCommonProp = {
  nodeName: string;
  selector: string;
};
