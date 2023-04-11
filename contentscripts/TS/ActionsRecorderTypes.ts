type ChromeExtensionMessage = {
  message: "start-recording" | "stop-recording" | "get-recording-status";
};

type ContentScriptMessage = {
  status: "new-recorded-action" | "current-recording-status";
  payload: Action | Boolean;
};

type ActionEventTypes =
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

type ActionTypes = "Interaction" | "Operators";

type ActionCommonProp = {
  nodeName: string;
  selector: string;
};

type ActionClickProp = {
  "Wait For New Page To load": Boolean;
  "Wait For File Download": Boolean;
  Description: string;
};

type ActionClickData = ActionCommonProp & ActionClickProp;

type AllActionProps = ActionClickProp;
type AllActionData = ActionClickData;

type Action = {
  name: ActionEventTypes;
  actionType: ActionTypes;
  props: AllActionData;
};
