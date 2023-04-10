export type ChromeExtensionMessage = {
  message: "start-recording" | "stop-recording" | "get-recording-status";
};

export type ContentScriptMessage = {
  status: "new-recorded-action" | "current-recording-status";
  payload: Action | Boolean;
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

export type ActionTypes = "Interaction" | "Operators";

export type ActionCommonProp = {
  nodeName: string;
  selector: string;
};

export type ActionClickProp = {
  "Wait For New Page To load": Boolean;
  "Wait For File Download": Boolean;
  Description: string;
};

export type ActionClickData = ActionCommonProp & ActionClickProp;

export type AllActionProps = ActionClickProp;
type AllActionData = ActionClickData;

export type Action = {
  name: ActionEventTypes;
  actionType: ActionTypes;
  props: AllActionData;
};
