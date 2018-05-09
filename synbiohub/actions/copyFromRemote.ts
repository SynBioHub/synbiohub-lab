
var pug = require('pug')

var async = require('async');

var request = require('request')

import serializeSBOL from 'synbiohub/serializeSBOL'

import config from 'synbiohub/config'

import loadTemplate from 'synbiohub/loadTemplate'

var extend = require('xtend')

import getUrisFromReq from 'synbiohub/getUrisFromReq'

import * as sparql from 'synbiohub/sparql/sparql'

const tmp = require('tmp-promise')

var fs = require('mz/fs');

import prepareSubmission from 'synbiohub/prepare-submission'
import DefaultSBOLFetcher from 'synbiohub/fetch/DefaultSBOLFetcher';
import DefaultMDFetcher from 'synbiohub/fetch/DefaultMDFetcher';


export default async function (req, res) {

    req.setTimeout(0) // no timeout


    var overwrite_merge:string|number = "unset"
    var collectionId = req.params.collectionId
    var version = req.params.version
    var name
    var description
    var citations = []

    let { graphUri, uri, designId } = getUrisFromReq(req)

    if (req.method === 'POST') {

        if(req.body.copyType === "new") {
            overwrite_merge = 0
        } else {
            overwrite_merge = 2
        }

        if(req.body.overwrite_objects) {
            overwrite_merge = overwrite_merge + 1;
        }

        overwrite_merge = overwrite_merge.toString()
        console.log(overwrite_merge)
        collectionId = req.body.id
        version = req.body.version
        let collectionUri = req.body.collections
        name = req.body.name
        description = req.body.description

        if (req.body.citations) {
            citations = req.body.citations.split(',').map(function (pubmedID) {
                return pubmedID.trim();
            }).filter(function (pubmedID) {
                return pubmedID !== '';
            });
        } else {
            citations = []
        }


        var collectionUri

        var errors = []
        if (overwrite_merge === "0" || overwrite_merge === "1") {

            if (collectionId === '') {
                errors.push('Please enter an id for your submission')
            }

            if (version === '') {
                errors.push('Please enter a version for your submission')
            }

            collectionUri = config.get('databasePrefix') + 'user/' + encodeURIComponent(req.user.username) + '/' + collectionId + '/' + collectionId + '_collection' + '/' + version

        } else {

            if (!collectionUri || collectionUri === '') {
                errors.push('Please select a collection to add to')
            }

            var tempStr = collectionUri.replace(config.get('databasePrefix') + 'user/' + encodeURIComponent(req.user.username) + '/', '')
            collectionId = tempStr.substring(0, tempStr.indexOf('/'))
            version = tempStr.replace(collectionId + '/' + collectionId + '_collection/', '')
            console.log('collectionId:' + collectionId)
            console.log('version:' + version)

        }

        if (errors.length > 0) {
            return copyFromRemoteForm(req, res, collectionId, version, {
                errors: errors
            })
        }

    } else {
        return copyFromRemoteForm(req, res, collectionId, version, {})
    }

    console.log('getting collection')

    var newRootCollectionDisplayId = collectionId + '_collection'

    console.log('uri:' + uri)
    console.log('graphUri:' + req.user.graphUri)

    let result = await DefaultSBOLFetcher.get(req).fetchSBOLObjectRecursive(uri)

    var sbol = result.sbol
    var collection = result.object

    if (version === 'current')
    version = '1'

    graphUri = req.user.graphUri
    uri = collectionUri

    console.log('check if exists:' + uri)

    let result2 = await DefaultMDFetcher.get(req).getCollectionMetadata(uri)

    if (!result2) {

        /* not found */
        console.log('not found')
        if (overwrite_merge === '0') {
            return copyFromRemote()
        } else {
            // NOTE: this should never happen, since chosen from a list of existing collections
            return copyFromRemoteForm(req, res, collectionId, version, {
                errors: ['Submission id ' + collectionId + ' version ' + version + ' not found']
            })
        }

    }

    const metaData = result2

    if (overwrite_merge === '0') {
        // Prevent make public
        console.log('prevent')
        return copyFromRemoteForm(req, res, collectionId, version, {
            errors: ['Submission id ' + collectionId + ' version ' + version + ' already in use']
        })

    } else if (overwrite_merge === '1') {
        // Overwrite
        console.log('overwrite')

        let uriPrefix = uri.substring(0, uri.lastIndexOf('/'))
        uriPrefix = uriPrefix.substring(0, uriPrefix.lastIndexOf('/') + 1)

        var templateParams = {
            collection: uri,
            uriPrefix: uriPrefix,
            version: version
        }

        var removeQuery = loadTemplate('sparql/removeCollection.sparql', templateParams)

        await sparql.deleteStaggered(removeQuery, req.user.graphUri)

        let templateParams2 = {
            uri: uri
        }
        removeQuery = loadTemplate('sparql/remove.sparql', templateParams2)

        await sparql.deleteStaggered(removeQuery, req.user.graphUri)

        await copyFromRemote()

    } else {
        // Merge
        console.log('merge')
        collectionId = metaData.displayId.replace('_collection', '')
        version = metaData.version

        return copyFromRemote()

    }

    async function saveTempFile() {

        let tmpFilename = await tmp.tmpName()

        await fs.writeFile(tmpFilename, serializeSBOL(sbol))

        return tmpFilename
    }

    async function copyFromRemote() {

        console.log('-- validating/converting');

        let tmpFilename = await saveTempFile()

        console.log('tmpFilename is ' + tmpFilename)

        let result = await prepareSubmission(tmpFilename, {
            copy: true,
            uriPrefix: config.get('databasePrefix') + 'user/' + encodeURIComponent(req.user.username) + '/' + collectionId + '/',

            name: name || '',
            description: description || '',
            version: version,

            rootCollectionIdentity: config.get('databasePrefix') + 'user/' + encodeURIComponent(req.user.username) + '/' + collectionId + '/' + collectionId + '_collection/' + version,
            newRootCollectionDisplayId: collectionId + '_collection',
            newRootCollectionVersion: version,
            ownedByURI: config.get('databasePrefix') + 'user/' + req.user.username,
            creatorName: req.user.name,
            citationPubmedIDs: citations,
            overwrite_merge: overwrite_merge

        })

        const { success, log, errorLog, resultFilename } = result

        if (!success) {

            const locals = {
                config: config.get(),
                section: 'invalid',
                user: req.user,
                errors: [errorLog]
            }

            res.send(pug.renderFile('templates/views/errors/invalid.jade', locals))

            return
        }

        console.log('upload')

        await sparql.uploadFile(req.user.graphUri, resultFilename, 'application/rdf+xml')

        return res.redirect('/manage');
    }
};

async function copyFromRemoteForm(req, res, collectionId, version, locals) {

    var collectionQuery = 'PREFIX dcterms: <http://purl.org/dc/terms/> PREFIX sbol2: <http://sbols.org/v2#> SELECT ?object ?name WHERE { ?object a sbol2:Collection . FILTER NOT EXISTS { ?otherCollection sbol2:member ?object } OPTIONAL { ?object dcterms:title ?name . }}'

    function sortByNames(a, b) {
        if (a.name < b.name) {
            return -1
        } else {
            return 1
        }
    }

    let collections = await sparql.queryJson(collectionQuery, req.user.graphUri)

    for(let result of collections) {
        result.uri = result.object
        result.name = result.name ? result.name : result.uri.toString()
        delete result.object
    }

    collections.sort(sortByNames)

    locals = extend({
        config: config.get(),
        section: 'copyFromRemote',
        user: req.user,
        collections: collections,
        submission: {
            id: collectionId || '',
            version: '1',
            name: '',
            description: '',
            citations: ''
        },
        errors: {}
    }, locals)

    res.send(pug.renderFile('templates/views/copyFromRemote.jade', locals))

    return
}

