/**
 * @NOTE : The Definitions below should be the same as the Actionflow FrontEnd ActionDefinitions.
 *  */

export const ActionNodeProps = {
  Common: {
    nodeName: "",
    selector: "",
  },
  Type: {
    Text: "",
    "Overwrite Existing Text": false,
  },
  Click: {
    "Wait For New Page To Load": false,
    "Wait For File Download": false,
    Description: "",
  },
  Scroll: {
    Direction: ["Top", "Bottom"],
    Description: "",
  },
  Hover: {
    Description: "",
  },
  Prompts: {
    "Response Type": {
      Accept: false,
      Decline: false,
    },
    "Response Text": "",
  },
  Select: {
    Selected: "",
    Options: [],
    Description: "",
  },
  Keypress: {
    Key: "",
    "Wait For Page To Load": false,
  },
  Date: {
    Date: "",
  },
  Upload: {
    Path: "",
  },
  Code: {
    Code: "",
  },
  List: {
    variable: "",
  },
  Text: {
    variable: "",
    value: "",
  },
  Attribute: {
    variable: "",
    attribute: "",
    value: "",
  },
  Anchor: {
    variable: "",
    value: "",
  },
  URL: {
    variable: "",
    value: "",
  },
  Tab: {
    url: "",
    tabId: "",
    windowId: "",
  },
};
