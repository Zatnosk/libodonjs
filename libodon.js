(function(){
	class Libodon {
		constructor(appname, redirect_url){
			this.appname = appname
			this.redirect_url = redirect_url
		}

		connect(server, username){
			return get_registration(server, this.appname, this.redirect_url)
			.then(reg=>get_token(server, reg))
			.then(token=>({result:'token',token:token}),
				  error=>({result:'redirect',target:get_authorization_url(server, reg)}))
		}
	}
	this.Libodon = Libodon

	const prefix = 'libodon'
	const log_errors = true
	const log_actions = true

	function get_token(server, registration){
		const token = localStorage.getItem(prefix+'_token')
		if(typeof token != 'string'){
			const re_match = /[?&]code=([^&]+)/.exec(window.location.search)
			if(!re_match){
				if(log_errors) console.error("Failed to find token in storage & no code found in URL parameters.")
				throw('no_token_or_code')
			}
			if(log_actions) console.log('fetching new token')
			const code = re_match[1]
			const endpoint = server+'/oauth/token'
			const data = new URLSearchParams()
			data.set('grant_type','authorization_code')
			data.set('client_id',registration.client_id)
			data.set('client_secret',registration.client_secret)
			data.set('redirect_uri',registration.redirect_uri)
			data.set('code',code)
			const fetchInit = {
				method:'POST',
				mode:'cors',
				body: data
			}
			return fetch(endpoint,fetchInit).then(res=>res.json()).then(obj=>{
				if(obj.error=='invalid_grant'){
					if(log_errors) console.error(obj.error_description)
					throw obj.error
				}
				localStorage.setItem(prefix+'_token',JSON.stringify(obj))
				return obj
			})
		} else {
			if(log_actions) console.log('reading token from storage')
			return new Promise(resolve=>resolve(JSON.parse(token)))
		}
		
	}

	function get_authorization_url(server, registration){
		let endpoint = server+'/oauth/authorize?response_type=code'
		endpoint += '&client_id='+registration.client_id
		endpoint += '&redirect_uri='+registration.redirect_uri
		return endpoint
	}

	function get_registration(server, appname, redirect_url){
		const reg = localStorage.getItem(prefix+'_registration')
		if(typeof reg != 'string'){
			if(log_actions) console.log('registering new app')
			const promise = register_application(server, appname, redirect_url)
			return promise.then(reg=>{
				localStorage.setItem(prefix+'_registration',JSON.stringify(reg))
				return reg
			})
		} else {
			if(log_actions) console.log('reading registration from storage')
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
