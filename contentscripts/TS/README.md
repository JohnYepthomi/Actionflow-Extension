### With tsconfig.json 
#### Run this command to compile to a single file
```
tsc
```
### Without tsconfig.json
 #### Run this command to compile into a single file 'action-recorder.js'.  
```
tsc --target ES2020 --lib "dom,ES2020"  --removeComments true --out ../action-recorder.js main.ts
```