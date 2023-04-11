const ActionNodeProps = {
  Common: {
    nodeName: "",
    selector: "",
  },
  Type: {
    Text: "",
    "Overwrite existing text": false,
  },
  Click: {
    "Wait For New Page To load": false,
    "Wait For File Download": false,
    Description: "",
  },
  Scroll: {
    "Scroll Direction": {
      Top: false,
      Bottom: false,
    },
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
    Value: "",
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
};
