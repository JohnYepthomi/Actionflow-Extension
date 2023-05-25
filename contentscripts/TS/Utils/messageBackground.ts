async function messageBackground(message: any){
  return await new Promise(async (res: any) => {
    await chrome.runtime.sendMessage(message, (response: any) => {
      if (chrome.runtime.lastError) {
          // Handle the error
          console.log({ message });
          console.error(chrome.runtime.lastError);
          return;
      }

      if(response)
        res(response);
      else res("no-response");
    });
  });
}