(function(){
	class Libodon {
		constructor(appname, redirect_url, scope){
			this.appname = appname
			this.redirect_url = redirect_url
			this.scope = scope
		}

		connect(server, username){
			let connection_resolve, connection_reject, registration;
			connections.push(new Promise((resolve,reject)=>{
				connection_resolve=resolve
				connection_reject=reject
			}))
			active_connection = connections.length-1
			return get_registration(server, this)
			.then(reg=>{
				registration = reg
				return get_token(server, reg)
			})
			.then(
			token=>{
				connection_resolve({server:server,token:token})
				return {result:'success'}
			},
			error=>{
				active_connection = undefined
				connection_reject({error:'failed connection'})
				return {result:'redirect',target:get_authorization_url(server, registration, this)}
			})
		}

		timeline(target, options){
			let endpoint = ''
			switch(target){
				case 'home': endpoint = '/api/v1/timelines/home'; break
				case 'mentions': endpoint = '/api/v1/timelines/mentions'; break
				case 'public': endpoint = '/api/v1/timelines/public'; break
				default:
					if(target.substring(0,1)=='#')
						endpoint = '/api/v1/timelines/tag/'+target.substring(1)
					break
			}
			if(endpoint=='') return Promise.reject('invalid timeline target')
			return get_request(endpoint+timeline_options(options))
		}

		status(id){return get_request('/api/v1/statuses/'+id)}
		account(id){return get_request('/api/v1/accounts/'+id)}
		account_self(){return get_request('/api/v1/accounts/verify_credentials')}
		account_statuses(id,options){
			return get_request('/api/v1/accounts/'+id+'/statuses'+timeline_options(options))
		}
		followers(id){return get_request('/api/v1/accounts/'+id+'/followers')}
		relationships(...ids){
			if(!ids.length) return Promise.reject('no id given')
			let query_parameters = '?'
			if(ids.length == 1) query_parameters += 'id='+ids[0]
			else query_parameters += 'id[]='+ids.join('&id[]=')
			return get_request('/api/v1/accounts/relationships'+query_parameters)
		}
		suggestions(){return get_request('/api/v1/accounts/suggestions')}
		context(id){return get_request('/api/v1/statuses/'+id+'/context')}
		reblogged_by(id){return get_request('/api/v1/statuses/'+id+'/reblogged_by')}
		favourited_by(id){return get_request('/api/v1/statuses/'+id+'/favourited_by')}

		follow_remote(url){return post_request('/api/v1/follows',{uri:url})}
		reblog(id){return post_request('/api/v1/statuses/'+id+'/reblog')}
		unreblog(id){return post_request('/api/v1/statuses/'+id+'/unreblog')}
		favourite(id){return post_request('/api/v1/statuses/'+id+'/favourite')}
		unfavourite(id){return post_request('/api/v1/statuses/'+id+'/unfavourite')}
		follow(id){return post_request('/api/v1/accounts/'+id+'/follow')}
		unfollow(id){return post_request('/api/v1/accounts/'+id+'/unfollow')}
		block(id){return post_request('/api/v1/accounts/'+id+'/block')}
		unblock(id){return post_request('/api/v1/accounts/'+id+'/unblock')}

		use_errorlog(){log_errors=true}
		use_actionlog(){log_actions=true}
	}
	this.Libodon = Libodon

	const connections = []
	let active_connection = undefined;

	const prefix = 'libodon'
	let log_errors = false
	let log_actions = false

	function timeline_options(options){
		if(typeof options == 'object'){
			const params = []
			if(options.max_id) params.push('max_id='+options.max_id)
			if(options.since_id) params.push('since_id='+options.since_id)
			if(options.limit) params.push('limit='+options.limit)
			if(options.only_media) params.push('only_media=1')
			if(options.local) params.push('local=1')
			if(params.length) return '?'+params.join('&')
		}
		return ''
	}

	function get_request(endpoint){
		if(connections.length == 0
			|| typeof active_connection=='undefined'
			|| typeof connections[active_connection]=='undefined'){
			return Promise.reject('not connected')
		}
		return connections[active_connection].then(conn=>{
			if(conn.error) return Promise.reject('not connected')
			const server = conn.server;
			const token = conn.token.access_token;
			const fetchHeaders = new Headers();
			fetchHeaders.set('Authorization','Bearer '+token);
			const fetchInit = {
				method:'GET',
				mode:'cors',
				headers: fetchHeaders
			}
			return fetch(server+endpoint, fetchInit).then(res=>res.json());
		})
	}

	function post_request(endpoint,data){
		if(connections.length == 0
			|| typeof active_connection=='undefined'
			|| typeof connections[active_connection]=='undefined'){
			return Promise.reject('not connected')
		}
		return connections[active_connection].then(conn=>{
			if(conn.error) return Promise.reject('not connected')
			const server = conn.server;
			const token = conn.token.access_token;
			const fetchHeaders = new Headers();
			fetchHeaders.set('Authorization','Bearer '+token);
			const body = new URLSearchParams()
			for(var key in data) body.set(key,data[key])
			const fetchInit = {
				method:'POST',
				mode:'cors',
				headers: fetchHeaders,
				body: body
			}
			return fetch(server+endpoint, fetchInit).then(res=>res.json());
		})
	}

	function get_token(server, registration){
		const token = localStorage.getItem(prefix+'_token_'+server)
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
				localStorage.setItem(prefix+'_token_'+server,JSON.stringify(obj))
				return obj
			})
		} else {
			if(log_actions) console.log('reading token from storage')
			return new Promise(resolve=>resolve(JSON.parse(token)))
		}
		
	}

	function get_authorization_url(server, registration, libodon){
		let endpoint = server+'/oauth/authorize?response_type=code'
		endpoint += '&client_id='+registration.client_id
		endpoint += '&redirect_uri='+registration.redirect_uri
		if(libodon.scope) endpoint += '&scope='+encodeURI(libodon.scope)
		return endpoint
	}

	function get_registration(server, libodon){
		const reg = localStorage.getItem(prefix+'_registration_'+server)
		if(typeof reg != 'string'){
			if(log_actions) console.log('registering new app')
			const promise = register_application(server, libodon)
			return promise.then(reg=>{
				localStorage.setItem(prefix+'_registration_'+server,JSON.stringify(reg))
				return reg
			})
		} else {
			if(log_actions) console.log('reading registration from storage')
			return new Promise(resolve=>resolve(JSON.parse(reg)))
		}
	}

	function register_application(server, libodon){
		const endpoint = server+'/api/v1/apps'
		const data = new URLSearchParams()
		data.set('response_type','code')
		data.set('client_name',libodon.appname)
		data.set('redirect_uris',libodon.redirect_url)
		data.set('scopes',libodon.scope)
		const fetchInit = {
			method:'POST',
			mode:'cors',
			body: data
		}
		return fetch(endpoint,fetchInit).then(res=>res.json())
	}
})()
