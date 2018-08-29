
var pug = require('pug')

var extend = require('xtend')

import * as ice from 'synbiohub/ice'

import config from 'synbiohub/config'

import getUrisFromReq from 'synbiohub/getUrisFromReq'
import DefaultSBOLFetcher from 'synbiohub/fetch/DefaultSBOLFetcher';

export default async function(req, res) {
	
    var iceRemote = config.get("defaultICEInstance")

    if (!iceRemote) {
	if(req.method === 'GET') {

	    var iceRemotes = []
	    if (req.user && req.user.isMember) {
		Object.keys(config.get('remotes')).filter(function(e){return config.get('remotes')[e].type ==='ice'}).forEach((remote) => {
		    iceRemotes.push(config.get('remotes')[remote])
		})
	    } else {
		Object.keys(config.get('remotes')).filter(function(e){return config.get('remotes')[e].type ==='ice' &&
 config.get('remotes')[e].public}).forEach((remote) => {
		    iceRemotes.push(config.get('remotes')[remote])
		})
	    }
	
		if (iceRemotes.length > 1) {
			let locals = {
				config: config.get(),
				section: 'createICEPart',
				user: req.user,
				iceRemotes: iceRemotes,
				submission: {}
			}
			res.send(pug.renderFile('templates/views/selectICERemote.jade', locals))
			return
		}

		if (iceRemotes.length === 0) {
			let locals = {
				config: config.get(),
				section: 'errors',
				user: req.user,
				errors: ['No ICE remote instances configured']
			}
			res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
			return
		}
	    
	    if (iceRemotes.length === 1) {
		iceRemote = iceRemotes[0].id
	    }

	} else {
	    iceRemote = req.body.iceRemote
	}
    }
    const { graphUri, uri, designId, share } = getUrisFromReq(req)
    
    let result = await DefaultSBOLFetcher.get(req).fetchSBOLObjectRecursive(uri)

	const sbol = result.sbol
	const componentDefinition = result.object

	const remoteConfig = config.get('remotes')[iceRemote]

	let iceResult = await ice.createSequence(remoteConfig, sbol, componentDefinition.name, componentDefinition.description)

	console.log(JSON.stringify(result))

	if (remoteConfig.partNumberPrefix) {

		throw new Error('need to update ice integration')
		//var partId = '' + iceResult.typeId
		/*while (partId.length < 6) {
			console.log('partId:' + partId)
			partId = '0' + partId
		}
		partId = remoteConfig.partNumberPrefix + '_' + partId
		console.log('PARTID:' + partId)
		res.redirect('/public/' + remoteConfig.id + '/' + partId + '/current')*/
	}

	res.redirect('/public/' + remoteConfig.id + '/available/current')
};


