
const pug = require('pug')

import * as sparql from 'synbiohub/sparql/sparql'

import loadTemplate from 'synbiohub/loadTemplate'

import config from 'synbiohub/config'

import wiky from 'synbiohub/wiky/wiky'

import retrieveCitations from 'synbiohub/citations'

export default async function(req, res) {

    // TODO reimplement

    /*

    const uri = req.body.uri

    const graphUri = getGraphUriFromTopLevelUri(uri,req.user)

    const citations = req.body.value

    var d = new Date();
    var modified = d.toISOString()
    modified = modified.substring(0,modified.indexOf('.'))

    const citationRegEx = /^[0-9]+(,[0-9]*)*$/
    if (citations && citations.trim() != '' && !citationRegEx.test(citations)) {
	return new Promise(function(resolve,reject) {
            reject(new Error('Citations must be comma separated Pubmed IDs'))
        })
    }

    var citationsSparql = ''
    if (citations.trim() != '') {
	citationsSparql = '<' + uri + '> obo:OBI_0001617 ' + JSON.stringify(citations).replace(/,/g,'\"; obo:OBI_0001617 \"') + ' .'
    } 

    const updateQuery = loadTemplate('./sparql/UpdateCitations.sparql', {
        topLevel: uri,
	citations: citationsSparql,
	modified: JSON.stringify(modified)
    })

    let ownedBy = await DefaultMDFetcher.get(req).getOwnedBy(uri)

    if(ownedBy.indexOf(config.get('databasePrefix') + 'user/' + req.user.username) === -1) {
        res.status(401).send('not authorized to edit this submission')
        return
    }

    let result = await sparql.updateQuery(updateQuery, graphUri)

    var templateParams = {
        uri: uri
    }

    var getCitationsQuery = loadTemplate('sparql/GetCitations.sparql', templateParams)

    let citationsQ = await sparql.queryJson(getCitationsQuery, graphUri)

    let submissionCitations = await retrieveCitations(citationsQ)

    const locals = {
        config: config.get(),
        src: citations,
        submissionCitations: submissionCitations,
        canEdit: true
    }

    res.send(pug.renderFile('templates/partials/citations.jade', locals))*/
}
