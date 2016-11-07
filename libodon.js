(function(){
	class Libodon {
		constructor(appname, redirect_url){
			this.appname = appname
			this.redirect_url = redirect_url
		}

		connect(server, username){
			return get_registration(server, this.appname, this.redirect_url)
		}
	}
	this.Libodon = Libodon

	function get_registration(server, appname, redirect_url){
		// cache result from register application
		const prefix = 'libodon'
		const reg = localStorage.getItem(prefix+'_registration')
		if(typeof reg != 'string'){
			console.log('registering new app')
			const promise = register_application(server, appname, redirect_url)
			return promise.then(reg=>{
				localStorage.setItem(prefix+'_registration',JSON.stringify(reg))
				return reg
			})
		} else {
			console.log('reading registration from storage')
			return new Promise(resolve=>resolve(JSON.parse(reg)))
		}
	}

	function register_application(server, appname, redirect_url){
		const endpoint = server+'/api/v1/apps'
		const data = new URLSearchParams()
		data.set('response_type','code')
		data.set('client_name',appname)
		data.set('redirect_uris',redirect_url)
		const fetchInit = {
			method:'POST',
			mode:'cors',
			body: data
		}
		return fetch(endpoint,fetchInit).then(res=>res.json())
	}
})()
