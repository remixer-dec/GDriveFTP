const fs = require('fs')
const https = require('follow-redirects').https;
const url = require('url')

const datargxp = /window\['[^']+'] = '([^']{10,})';/m
const keyregexp = /^[^"]+"([A-z0-9_-]+)".+client-channel/m
class File{
    constructor(type,id,name,size,d){
        this.isFolder = type === 'application/vnd.google-apps.folder'
        this.type = type
        this.id = id
        this.name = name
        this.size = size || 0
        this.mtime = d
        this.ctime = d
        this.atime = new Date()
        this.isDirectory = function(){
            return this.isFolder
        }
        return this
    }
}

class GDParser{
    constructor(){
        this.allFiles = []
    }
    parseData(rawhtml){
        let data = rawhtml.match(datargxp)
        let files = []
        if(data){
            data = JSON.parse(eval(`'${data[1]}'`));
            //this is the fastest way to decode \xb5 symbols, unescape and decodeURIComponent doesn't work
            data = data ? data[0] : []
            if(!data){data = []}
            for(let i=0,l=data.length;i<l;i++){
                let d = data[i]
                files.push(new File(d[3],d[0],d[2],d[13],d[9]))
            }
            return files
        } else {
            return []
        }
    }
    parseFolderID(link){
        let m = url.parse(link).pathname
        if(m == 'anonymous'){return false}
        m = m.match(/([0-9A-z_-]{4,50})$/i)
        return m ? m[1] : false
    }
    generateDLLink(fileID){
        return `https://drive.google.com/uc?id=${fileID}&export=download`
    }
    DL(link){
        try{
            var streamer = require("stream")
            var stream = new streamer.PassThrough()

            return new Promise((rs,rj)=>{
                https.get(link, function(res) {
                    rs({stream:stream})
                    res.pipe(stream)
                });
            })
        } catch(e){console.error(e)}
    }
    parseFolder(folderID){
        return folderID ? this.loadAndParse('https://drive.google.com/drive/folders/'+folderID,folderID) : Promise.reject()
    }
    httpsrq(link,headers){
        return new Promise((rs,rj)=>{
            link = url.parse(link)
            let options = {
                host: link.host,
                path: link.path,
                headers: {'user-agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36',...headers}
            };
            https.get(options, (resp) => {
                console.log('GD page statusCode:', resp.statusCode);
                let data = '';
                resp.on('data', (chunk) => {data += chunk});
                resp.on('end', () => {
                    rs(data)
                });
            }).on("error", (err) => {
                rj(err);
            })
        })
    }
    nextpage(folderID,key,pagekey=''){
        let link = `https://clients6.google.com/drive/v2beta/files?openDrive=true&reason=102&syncType=0&errorRecovery=false&q=trashed%20%3D%20false%20and%20%27${folderID}%27%20in%20parents&fields=kind%2CnextPageToken%2Citems(kind%2CmodifiedDate%2CmodifiedByMeDate%2ClastViewedByMeDate%2CfileSize%2Cowners(kind%2CpermissionId%2CdisplayName%2Cpicture)%2ClastModifyingUser(kind%2CpermissionId%2CdisplayName%2Cpicture)%2ChasThumbnail%2CthumbnailVersion%2Ctitle%2Cid%2Cshared%2CsharedWithMeDate%2CuserPermission(role)%2CexplicitlyTrashed%2CmimeType%2CquotaBytesUsed%2Cshareable%2Ccopyable%2CfileExtension%2CsharingUser(kind%2CpermissionId%2CdisplayName%2Cpicture)%2Cspaces%2Ceditable%2Cversion%2CteamDriveId%2ChasAugmentedPermissions%2CcreatedDate%2CtrashingUser(kind%2CpermissionId%2CdisplayName%2Cpicture)%2CtrashedDate%2Cparents(id)%2Ccapabilities(canCopy%2CcanDownload%2CcanEdit%2CcanAddChildren%2CcanDelete%2CcanRemoveChildren%2CcanShare%2CcanTrash%2CcanRename%2CcanReadTeamDrive%2CcanMoveTeamDriveItem)%2Clabels(starred%2Chidden%2Ctrashed%2Crestricted%2Cviewed))%2CincompleteSearch&appDataFilter=NO_APP_DATA&spaces=drive${pagekey}&maxResults=100&orderBy=folder%2Ctitle_natural%20asc&key=${key}`
        return this.httpsrq(link,{referer:' https://drive.google.com/drive/folders/'+folderID, origin:'https://drive.google.com'})
    }
    loadAndParse(link,folderID){
        return new Promise(async (resolve,reject)=>{
            let data = await this.httpsrq(link)
            let pagefiles = this.parseData(data)
            if(pagefiles.length >= 50){
                let key = data.match(keyregexp)[1];
                let pagedata = JSON.parse(await this.nextpage(folderID,key,''))
                for(let file of pagedata.items){
                    pagefiles.push(new File(file.mimeType,file.id,file.title,parseInt(file.fileSize),new Date(file.modifiedDate)))
                }
                while(pagedata.nextPageToken){
                    pagedata = JSON.parse(await this.nextpage(folderID,key,'&pageToken='+pagedata.nextPageToken))
                    for(let file of pagedata.items){
                        pagefiles.push(new File(file.mimeType,file.id,file.title,parseInt(file.fileSize),new Date(file.modifiedDate)))
                    }
                }
            }
            return resolve(pagefiles)
        })
    }
    dirify(p){
        return (p.slice(-1) != '/') ? p+'/' : p
    }
    addToList(path,files){
        path = this.dirify(path)
        return this.allFiles[path] = files
    }
    init(folders){
        if(!folders || folders.length === 0){return []}
        this.allFiles['/'] = []
        for(let folder of folders){
            this.allFiles['/'].push(new File('application/vnd.google-apps.folder',this.parseFolderID(folder.id),folder.name,0,new Date()))
        }
        return this.allFiles['/']
    }
}

module.exports = new GDParser()
