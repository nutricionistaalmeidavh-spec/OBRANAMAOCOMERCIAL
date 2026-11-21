'use strict'
const os=require('node:os')
// Desktop local: a única identidade verificável offline é a conta do sistema operacional.
// Não confundir usuário do computador com identidade humana individual nem criar login paralelo.
function localFinanceActor({userInfo=()=>os.userInfo(),hostname=()=>os.hostname()}={}){
 const u=userInfo()
 const login=String(u?.username||'').trim().replace(/[^a-zA-Z0-9_.@-]/g,'_').slice(0,48)
 const host=String(hostname()||'').trim().replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,48)
 if(!login||!host)throw Error('Não foi possível verificar a conta local do sistema operacional para auditar esta ação.')
 return 'os:'+login+'@'+host
}
module.exports={localFinanceActor}
