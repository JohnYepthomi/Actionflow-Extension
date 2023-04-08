// console.log("safeScript: Trying to import ActionsRecorder Injected.");

if (window.INJECTED !== 1) {
   window.INJECTED = 1;
   console.log("safeScript Injected");
  // content2.js must be exposed via web_accessible_resources
  import(chrome.runtime.getURL("contentscripts/ActionsRecorder.js"));
}
