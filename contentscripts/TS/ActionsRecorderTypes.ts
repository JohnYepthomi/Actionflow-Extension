type ChromeExtensionMessage = {
  message?: "start-recording" | "stop-recording" | "get-recording-status";
  status?: "compose-completed";
  payload?: Action | string | boolean;
};

type ContentScriptMessage = {
  status: "new-recorded-action" | "current-recording-status";
  actionType: ActionEventTypes;
  payload: Action | Boolean;
};

type ActionEventTypes =
  | "Visit"
  | "NewTab"
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

/* COMMON PROPS */
type CommonProp = {
  nodeName: string;
  selector: string;
};

/* ACTION PROPS */
type ClickProp = {
  "Wait For New Page To load": boolean;
  "Wait For File Download": boolean;
  Description: string;
};

type ActionClickProp = CommonProp & ClickProp;

type AllActionProps = ActionClickProp;

type Action = {
  actionType: ActionEventTypes;
  props: AllActionProps;
};
