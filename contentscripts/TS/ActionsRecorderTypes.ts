/* ------------------ MESSAGE FROM FRONTEND ---------------  */

type FromFrontendMessage =
  | StartRecordingMessage
  | StopRecordingMessage
  | ComposeCompletedMessage
  | ElementActionStartMessage;

type StartRecordingMessage = {
  message: "start-recording";
  payload: boolean;
};
type StopRecordingMessage = {
  message: "stop-recording";
  payload: boolean;
};
type ComposeCompletedMessage = {
  message: "compose-completed";
  payload: Action;
};
type ElementActionStartMessage = {
  message: "element-pick";
  payload: {
    id: string;
    actionType: "List" | "Text" | "Attribute" | "Anchor" | "Click" | "URL";
    props: {
      attribute?: string;
    };
  };
};

/* ------------------ MESSAGE TO FRONTEND ---------------  */

type ToFrontendMessage = ToRecordedActionMessage | ToElementActionUpdateMessage;
type ToRecordedActionMessage = {
  status: "new-recorded-action";
  payload: {
    type: "RECORDED_ACTION";
    payload: {
      actionType: ActionEventTypes;
      props: Action;
    };
  };
};
// This type is the same as TEvtWithProps type: "UPDATE_INTERACTION" 's variant used in FrontEnd.
type ToElementActionUpdateMessage = {
  status: "element-action-update";
  payload: {
    type: "UPDATE_INTERACTION";
    payload: {
      actionId: string;
      props: {
        nodeName: string;
        selector: string;
        value?: string;
      };
    };
  };
};

/* ------------------ PARTIAL ACTION TYPES ---------------  */

type ActionEventTypes =
  | "Visit"
  | "Click"
  | "Scroll"
  | "Keypress"
  | "Type"
  | "Hover"
  | "Select"
  | "Date"
  | "NewTab"
  | "Upload"
  | "Code"
  | "Prompts"
  | "List"
  | "Text"
  | "Attribute"
  | "Link";

/*--------------------- COMMON PROPS -------------------*/
// Same type as TCommonProps used in FrontEnd.
type CommonProp = {
  nodeName: string;
  selector: string;
};

/*/*---------------------- ACTION PROPS ----------------*/
// Same/Partial Prop Types as used in FrontEnd
type ClickProp = {
  "Wait For New Page To Load": boolean;
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

/*-------------------------------------------------------*/

type ActionElementAttributeProp = CommonProp;
type ActionElementTextProp = CommonProp;
type ActionListProp = CommonProp;
type ActionClickProp = CommonProp & ClickProp;
type ActionSelectProp = CommonProp & SelectProp;
type ActionTypeProp = CommonProp & TypeProp;

type AllActionProps =
  | ActionClickProp
  | ActionSelectProp
  | ActionTypeProp
  | ActionElementAttributeProp
  | ActionElementTextProp;

/*-------------------------------------------------------*/
type Action = AllActionProps;
/* -------------------------- END ----------------------  */
