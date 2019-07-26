const {FtpSrv, FileSystem} = require('ftp-srv');
const fs = require('fs')
const p = require('path')

const CFG = Object.freeze(require('./config.json'))
const G = require('./GDParser')
let lastuser = false

G.init(CFG.folders)
class GDriveFS extends FileSystem {
  constructor(connection, {root, cwd} = {}) {
      super(connection, root, cwd);
      this.connection = connection;
      this._root = CFG.fid_in_username ? G.parseFolderID(connection.username) : false
      this.cwd = cwd ? cwd : this._root
      this.realCWD = '/'
      G.init(CFG.folders)
      if(CFG.fid_in_username && connection.username != lastuser){
          G.allFiles = []
          lastuser = connection.username
      }
  }
  currentDirectory(){
      return this.realCWD
  }
  get(fileName) { //dummy method for compatibility
      return {name:'.',isDirectory:()=>true,size:1,atime:new Date(),mtime:new Date(),ctime:new Date(),uid:0,gid:0,mode:fs.constants.R_OK}
  }
  pathFormatter(path){
      path = p.posix.parse(path);
      path.dir = p.posix.format({dir:path.dir,root:path.root})
      return path
  }
  pathFinder(path){
      //method attempts to find known folder ID and create parse-chain
      async function find(paths){
          let prevpth = '/'
          for(let pth of paths){
              if(pth[1]){
                  await G.parseFolder(pth[1]).then(f=>G.addToList(pth[0],f)).catch(e=>[])
                  prevpth = G.dirify(pth[0])
              } else{
                  if(!prevpath){prevpath = '/'}
                  let fnd = G.allFiles[prevpth].find(x=>x.name == p.parse(pth[0]).base)
                  if(!fnd){pth.pop();break}
                  await G.parseFolder(fnd.id).then(f=>G.addToList(pth[0],f)).catch(e=>[])
                  prevpth = G.dirify(pth[0])
              }
          }
          return G.allFiles[paths[paths.length-1][0]]
      }
      let toFind = []
      let prevpath = path
      while(path != '/'){
          if(!(path in G.allFiles)){
              toFind.push([path,false])
          } else {
              toFind.push([path,G.allFiles[path].find(f=>f.name == p.parse(prevpath).base).id])
              break
          }
          prevpath = path
          path = p.posix.resolve(path,'..')
      }
      if(!('/' in G.allFiles)){
          toFind.push(['/',this._root])
      }
      toFind = toFind.reverse()
      return find(toFind)
  }

  list(path = '.') {
      if(path != '.'){
          this.realCWD = path
      }
      if(this.realCWD in G.allFiles){
          return G.allFiles[this.realCWD]
      }
      let cwd = this.cwd
      let rdir = false
      if(this.realCWD != '/'){
          let cpath = this.pathFormatter(this.realCWD)
          if(G.allFiles[cpath.dir]){
              let lastone = G.allFiles[cpath.dir].find(f=>f.name === cpath.base)
              if(lastone){
                if(lastone.isFolder){
                    cwd = lastone.id
                } else{
                    this.connection.reply(250,'This is not a directory')
                }
              }
          } else {
              return this.pathFinder(this.realCWD)
          }
      } else {
          rdir = true
      }
      return G.parseFolder(cwd)
      .then(f=>G.addToList(this.realCWD,(rdir?[].concat(G.init(CFG.folders),f):f)))
      .catch(e=>{let x=G.allFiles[this.realCWD];return (rdir?[].concat(G.init(CFG.folders),x?x:[]):x)})
  }
  chdir(path = '.') {
      if(path[0] != '/'){
          path = p.posix.resolve(this.realCWD, path);
      }
      let cpath = this.pathFormatter(path)
      if(path.substr(-1) != '/' && !(G.allFiles[cpath.dir] ? G.allFiles[cpath.dir].find(f=>f.name == cpath.base).isFolder:false)){
          this.connection.reply(550,'No such directory.')
          return new Promise(()=>{}) //prevent default server response to maximize compatibility
      }
      this.realCWD = path
  }
  read(fileName, {start = undefined} = {}) {
      if(fileName[0] !='/'){
          fileName = p.posix.resolve(this.realCWD,fileName)
      }
      let path = this.pathFormatter(fileName)
      try {
          if(!G.allFiles[path.dir]){
              return new Promise((rs,rj)=>this.pathFinder(path.dir).then(f=>{
                  rs(G.DL(G.generateDLLink(G.allFiles[path.dir].find(f=>f.name == path.base).id)))
              }))
          } else {
              return G.DL(G.generateDLLink(G.allFiles[path.dir].find(f=>f.name == path.base).id))
          }
      } catch(e){
          console.error(e)
      }
  }
  write(){}
  delete(){}
  mkdir(){}
  rename(){}
  chmod(){}
  mkdir(){}
}
// DEBUG:
/*
var bunyan = require('bunyan');
var log = bunyan.createLogger({level:'trace',name:'debuglog'})

ftpServer = new FtpSrv({log:log,...CFG})
ftpServer.on('client-error', ({ connection, context, error }) => {
    console.log(context);
    console.log(error);
});

ftpServer.on('error', (err) => {
    console.log(err);
});

ftpServer.on('uncaughtException', (err) => {
    console.log(err);
})
ftpServer.on('data', (d) => {
    console.log(d)
})
*/

// RELEASE:
ftpServer = new FtpSrv(CFG)
if (!module.parent) {
    ftpServer.listen()
}
ftpServer.on('login', ({connection, username, password}, resolve, reject) => {
    resolve({fs:new GDriveFS(connection),cwd:'/'})
});

module.exports =
{
    server: ftpServer,
    configuration:CFG,
    GDriveFS: GDriveFS,
    GDParser: G,
    FtpSrv:FtpSrv
}
