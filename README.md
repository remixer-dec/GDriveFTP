# GDriveFTP  
With this project you can create a read-only FTP Proxy-Server from Google Drive public folders. So you can have your FTP server that uses Google Drive instead of your filesystem.  
This is an experimental project, created for educational purposes, there is no warranty that it will work with your FTP client / public folder. It parses information directly from GD's web pages. That information format can change over time. This project should not be used in production, it has almost no user-input restrictions.  

### Key features:  
- no API key required, information is parsed from web pages, emulating browser activity  
- folders with 50+ files are supported  
- dynamic input and flexibility: you can put a folder ID in FTP username, and any password, to connect to a server, or you can include multiple GDrive folders in configuration file  

### Limitations:  
- folder data structure is cached until server restart (or if dynamic mode is enabled, until reconnect with other username)  
- with ```fid_in_username``` configuration, only 1 user can navigate simultaneously, without it, multi-user support has not been tested.  
- everything is in read-only mode  
- use this project at your own risk, FTP server has not been tested in high-load mode  

### Supported clients:  
This project's FTP Server is compatible with: Chrome, Firefox, Windows Explorer, FileZilla, FtpExpress (Android), FX (Android).  

### Requirements:  
Node.js, npm  

### Installation:  
```git clone https://github.com/remixer-dec/GDriveFTP```  
```cd GDriveFTP```  
```npm i```  

### Usage:  
1) configure server in ```config.json```  
2) run it with ```node gdftp.js ```  

### Configuration:  
You can read more about FTP Server configuration [here](https://github.com/trs/ftp-srv#api)  
```"fid_in_username"``` - (bool) allows providing ID for a folder that will be used as root directory in FTP username  
```"folders"``` - (array) - adds GDrive folders into root directory. A directory should be in the following format:  
```javascript
{"id":"LINK_TO_GDRIVE_FOLDER_OR_ID_OF_THAT_FOLDER","name":"ANY_FOLDER_NAME"}
```  
use `,` to separate multiple folders

### Using as a module:  
```npm i gdriveftp```
```javascript
const gdftp = require('gdriveftp')
gdftp.server.listen()
console.log(Object.keys(gdftp))
```    
you can access all internal classes and objects, including GDParser from imported module  

### Troubleshooting:  
if you have connection issues, try to change IP/port or set IP configuration directly to your network interface's IP address.  

### P.S.  
I was trying to find a good FTP-server for node that supports filesystem override, but everything else was outdated / not working. So yes, this project is using [ftp-srv](https://github.com/trs/ftp-srv) with all their tons of dependencies.
