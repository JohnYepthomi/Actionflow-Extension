type ChromeExtensionMessage = {
  message?:
    | "start-recording"
    | "stop-recording"
    | "get-recording-status"
    | "compose-completed"
    | "pick-list-element";
  payload?: Action | string | boolean;
};

type ContentScriptMessage = {
  status: "new-recorded-action" | "current-recording-status";
  actionType: ActionEventTypes;
  payload: Action | Boolean;
};
/*-------------------------*/
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

/*------ COMMON PROPS -------*/

type CommonProp = {
  nodeName: string;
  selector: string;
};

/*------ ACTION PROPS ------*/

type ClickProp = {
  "Wait For New Page To load": boolean;
  "Wait For File Download": boolean;
  Description: string;
};
type SelectProp = {
  Selected: string;
  Options: string[];
  Description: string;
};
type TypeProp = {
  Text: string;
  "Overwrite Existing Text": boolean;
};

/*-------------------------*/
type ActionClickProp = CommonProp & ClickProp;
type ActionSelectProp = CommonProp & SelectProp;
type ActionTypeProp = CommonProp & TypeProp;

type AllActionProps = ActionClickProp | ActionSelectProp | ActionTypeProp;

/*-------------------------*/
type Action = {
  actionType: ActionEventTypes;
  props: AllActionProps;
};
