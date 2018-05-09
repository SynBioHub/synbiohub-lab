
import SBOLFetcher from "./SBOLFetcher";

import SBOLDocument = require('sboljs')
import Range = require('sboljs/lib/Range')
import GenericLocation = require('sboljs/lib/GenericLocation')
import Cut = require('sboljs/lib/Cut')

import request = require('request')

import * as ice from 'synbiohub/ice'
import splitUri from 'synbiohub/splitUri'
import config from 'synbiohub/config'

import doiRegex = require('doi-regex')


export default class SBOLFetcherICE extends SBOLFetcher {

    private remoteConfig:any

    constructor(remoteConfig:any) {

        super()

        this.remoteConfig = remoteConfig
    }

    async fetchSBOLObjectRecursive(sbol, type, uri) {

        const { displayId } = splitUri(uri)

        const version = '1' //new Date().getTime() + '_retrieved'

        if (displayId === this.remoteConfig.rootCollection.displayId) {

            const rootCollection = sbol.collection()
            rootCollection.displayId = this.remoteConfig.rootCollection.displayId
            rootCollection.version = version
            rootCollection.persistentIdentity = config.get('databasePrefix') + 'public/' + rootCollection.displayId
            rootCollection.uri = config.get('databasePrefix') + 'public/' + rootCollection.displayId + '/' + rootCollection.version
            rootCollection.wasDerivedFrom = this.remoteConfig.url
            rootCollection.name = this.remoteConfig.rootCollection.name || ''
            rootCollection.description = this.remoteConfig.rootCollection.description || ''

            let rootFolders = await ice.getRootFolders(this.remoteConfig)

            let collections = await Promise.all(
                rootFolders.map((folder) => folderToCollection(folder.id))
            )

            for (let collection of collections) {
                rootCollection.addMember(collection)
            }

            return {
                sbol: sbol,
                object: rootCollection,
                remote: true
            }
        }

        if (displayId === 'available') {

            let collection = await availableFolderToCollection("available")

            return {
                sbol: sbol,
                object: collection,
                remote: true
            }
        }

        if (displayId.indexOf(this.remoteConfig.folderPrefix) === 0) {

            const folderId = parseInt(displayId.slice(this.remoteConfig.folderPrefix.length))

            let collection = await folderToCollection(folderId)

            return {
                sbol: sbol,
                object: collection,
                remote: true
            }
        }

        if (displayId.endsWith(this.remoteConfig.sequenceSuffix)) {

            const partDisplayId = displayId.slice(0, - this.remoteConfig.sequenceSuffix.length)

            let part = await ice.getPart(this.remoteConfig, partDisplayId)

            let iceSbol:any = await ice.getSequence(this.remoteConfig, part.id)

            const iceSequence = iceSbol.sequences[0]

            const sequence = sbol.sequence()
            sequence.displayId = partDisplayId + this.remoteConfig.sequenceSuffix
            sequence.name = part.name + ' sequence'
            sequence.description = ''
            sequence.version = version
            sequence.persistentIdentity = config.get('databasePrefix') + 'public/' + this.remoteConfig.id + '/' + sequence.displayId
            sequence.uri = sequence.persistentIdentity + '/' + sequence.version
            sequence.encoding = iceSequence.encoding
            sequence.elements = iceSequence.elements
            sequence.wasDerivedFrom = this.remoteConfig.url + '/entry/' + part.id

            return {
                sbol: sbol,
                object: sequence,
                remote: true
            }
        }

        let part = await ice.getPart(this.remoteConfig, displayId)

        let componentDefinition = await partToComponentDefinition(part)

        return {
            sbol: sbol,
            object: componentDefinition,
            remote: true
        }


        async function availableFolderToCollection(folderId) {

            let entries = await ice.getRootFolderEntries(this.remoteConfig)

            const collection = sbol.collection()
            collection.displayId = 'available'
            collection.version = version
            collection.persistentIdentity = config.get('databasePrefix') + 'public/' + this.remoteConfig.id + '/' + collection.displayId
            collection.uri = collection.persistentIdentity + '/' + collection.version
            collection.name = 'All Available Entries'
            collection.description = 'Contains all available entries'
            collection.wasDerivedFrom = this.remoteConfig.url + '/folders/available'

            let componentDefinitions = await Promise.all(entries.map(async (entry) => {
                let part = await ice.getPart(this.remoteConfig, entry.partId)

                return await this.partToComponentDefinition(part)
            }))

            for (let componentDefinition of componentDefinitions) {
                collection.addMember(componentDefinition)
            }

            return collection
        }

        async function folderToCollection(folderId) {

            let res = await Promise.all([
                ice.getFolder(this.remoteConfig, folderId),
                ice.getFolderEntries(this.remoteConfig, folderId)
            ])

            const [folder, entries] = res
            const collection = sbol.collection()
            collection.displayId = this.remoteConfig.folderPrefix + folder.id
            collection.version = version
            collection.persistentIdentity = config.get('databasePrefix') + 'public/' + this.remoteConfig.id + '/' + collection.displayId
            collection.uri = collection.persistentIdentity + '/' + collection.version
            collection.name = folder.folderName
            collection.description = ''
            collection.wasDerivedFrom = this.remoteConfig.url + '/folders/' + folderId

            collection.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#folderType', folder.type)

            if (folder.creationTime)
                collection.addStringAnnotation('http://purl.org/dc/terms/created', folder.creationTime + '')

            if (folder.modificationTime)
                collection.addStringAnnotation('http://purl.org/dc/terms/modified', folder.modificationTime + '')

            if (folder.owner) {
                collection.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#ownerEmail', folder.owner.email + '')
                collection.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#ownerId', folder.owner.id + '')
            }

            let componentDefinitions = await Promise.all(entries.map(async (entry) => {

                let part = await ice.getPart(this.remoteConfig, entry.partId)

                return this.partToComponentDefinition(part)

            }))

            for (let componentDefinition of componentDefinitions) {
                collection.addMember(componentDefinition)
            }

            return collection
        }

        async function partToComponentDefinition(part) {

            if(part.hasSequence) {

                let seq = await ice.getSequence(this.remoteConfig, part.id)

                return createSBOL(seq)
                
            } else {

                return createSBOL()

            }

            function createSBOL(iceSbol?) {

                /* { "id": 130, "type": "STRAIN", "visible": "OK", "parents": [], "index": 0, "recordId": "cbf8d2cf-53c4-46ef-a661-4e13f7d8b901",
                    *  "name": "JBEI-2464", "owner": "system", "ownerEmail": "system", "ownerId": 21, "creator": "Rachel Krupa", "creatorEmail": "",
                    *      "creatorId": 0, "status": "complete", "shortDescription": "Biobrick B expression vector", "longDescription": "",
                    *          "references": "", "creationTime": 1312923433031, "modificationTime": 1312923433031, "bioSafetyLevel": 1,
                    *             "intellectualProperty": "", "partId": "JPUB_000130", "links": [],
                    *             "principalInvestigator": "Jay Keasling", "principalInvestigatorId": 0,
                    *             "selectionMarkers": [ "Chloramphenicol" ], "fundingSource": "", "basePairCount": 0, "featureCount": 0,
                    *             "viewCount": 0, "hasAttachment": false, "hasSample": false, "hasSequence": false, "hasOriginalSequence": false,
                    *             "parameters": [], "canEdit": false, "accessPermissions": [], "publicRead": true, "linkedParts": [],
                    *             "strainData": { "host": "DH10B", "genotypePhenotype": "" } }*/

                const componentDefinition = sbol.componentDefinition()
                componentDefinition.displayId = part.partId
                componentDefinition.version = version
                componentDefinition.persistentIdentity = config.get('databasePrefix') + 'public/' + this.remoteConfig.id + '/' + componentDefinition.displayId
                componentDefinition.uri = componentDefinition.persistentIdentity + '/' + componentDefinition.version
                componentDefinition.name = part.name || ''
                componentDefinition.description = part.shortDescription || ''
                componentDefinition.wasDerivedFrom = this.remoteConfig.url + '/entry/' + part.partId

                if (iceSbol && iceSbol.componentDefinitions[0] && iceSbol.componentDefinitions[0].uri) {
                    componentDefinition.wasDerivedFrom = iceSbol.componentDefinitions[0].uri
                }

                componentDefinition.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#entry', this.remoteConfig.url + '/entry/' + part.partId)
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#id', part.id + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#type', part.type + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#visible', part.visible + '')
                // parents
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#index', part.index + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#recordId', part.recordId + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#owner', part.owner + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#ownerEmail', part.ownerEmail + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#ownerId', part.ownerId + '')
                componentDefinition.addStringAnnotation('http://purl.org/dc/elements/1.1/creator', part.creator + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#creatorEmail', part.creatorEmail + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#creatorId', part.creatorId + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#status', part.status + '')

                if(part.longDescription)
                    componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#mutableDescription', part.longDescription + '')

                if(part.references) {

                    componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#references', part.references + '')

                    const DOIs = part.references.match(doiRegex())
                        
                    if(DOIs) {
                        DOIs.forEach((doi) => {
                            componentDefinition.addStringAnnotation('http://edamontology.org/data_1188', doi + '')
                        })
                    }

                    const pmids = (/PMID:[ \t]*([0-9]+)/gi).exec(part.references)
                        
                    if(pmids) {
                        for(var i = 1; i < pmids.length; ++ i) {
                            componentDefinition.addStringAnnotation('http://purl.obolibrary.org/obo/OBI_0001617', pmids[i])
                        }
                    }

                }

                componentDefinition.addStringAnnotation('http://purl.org/dc/terms/created', new Date(part.creationTime).toISOString() + '')
                componentDefinition.addStringAnnotation('http://purl.org/dc/terms/modified', new Date(part.modificationTime).toISOString() + '')
                componentDefinition.addStringAnnotation('http://purl.obolibrary.org/obo/ERO_0000316', part.bioSafetyLevel + '')

                if(part.intellectualProperty)
                    componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#intellectualProperty', part.intellectualProperty + '')

                // links
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#principalInvestigator', part.principalInvestigator + '')
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#principalInvestigatorId', part.principalInvestigatorId + '')
                // selectionMarkers
                componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#viewCount', part.viewCount + '')

                if(part.fundingSource)
                    componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#fundingSource', part.fundingSource + '')

                if(part.strainData) {
                    componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#host', part.strainData.host + '')
                    componentDefinition.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/ice#genotypePhenotype', part.strainData.genotypePhenotype + '')
                }
                // parameters
                // linkedParts
                // strainData

                switch(part.type) {
                    case 'PART':
                    case 'PLASMID':
                        componentDefinition.addType(SBOLDocument.terms.dnaRegion)
                        break

                    case 'STRAIN':
                        componentDefinition.addType('http://wiki.synbiohub.org/wiki/Terms/ice#STRAIN')
                        break

                    default:
                        throw new Error(part.type)

                }

                if(iceSbol) {

                    var iceSequence

                    if(iceSbol.sequences.length > 0) {

                        iceSequence = iceSbol.sequences[0]

                        const sequence = sbol.sequence()
                        sequence.displayId = componentDefinition.displayId + this.remoteConfig.sequenceSuffix
                        sequence.name = componentDefinition.name + ' sequence'
                        sequence.version = componentDefinition.version
                        sequence.persistentIdentity = config.get('databasePrefix') + 'public/' + this.remoteConfig.id + '/' + sequence.displayId
                        sequence.uri = sequence.persistentIdentity + '/' + sequence.version
                        sequence.encoding = iceSequence.encoding
                        sequence.elements = iceSequence.elements
                        sequence.wasDerivedFrom = this.remoteConfig.url + '/entry/' + part.id
                        componentDefinition.addSequence(sequence)

                    }

            iceSbol.components.forEach((iceComp) => {
                        const comp = sbol.component()
                        comp.displayId = iceComp.displayId
                        comp.name = iceComp.name
                        comp.version = componentDefinition.version
                        comp.persistentIdentity = componentDefinition.persistentIdentity + '/' + comp.displayId
                        comp.uri = comp.persistentIdentity + '/' + componentDefinition.version

                comp.roleIntegration = iceComp.roleIntegration
                
                iceComp.mappings.forEach((mapping) => {
                comp.addMapping(mapping)
                })

                iceComp.roles.forEach((role) => {
                comp.addRole(role.toString().replace('http://purl.obolibrary.org/obo/SO_','http://identifiers.org/so/SO:'))
                })

                comp.access = iceComp.access
                comp.definition = iceComp.definition
                componentDefinition.addComponent(comp)
            })

                    iceSbol.sequenceAnnotations.forEach((iceSA) => {

                        const sa = sbol.sequenceAnnotation()
                        sa.displayId = iceSA.displayId
                        sa.name = iceSA.component.definition?iceSA.component.definition.name:iceSA.name
                        sa.version = componentDefinition.version
                        sa.persistentIdentity = componentDefinition.persistentIdentity + '/' + sa.displayId
                        sa.uri = sa.persistentIdentity + '/' + componentDefinition.version

                iceSA.roles.forEach((role) => {
                sa.addRole(role.toString().replace('http://purl.obolibrary.org/obo/SO_','http://identifiers.org/so/SO:'))
                })

                if (iceSA.component) { 
                sa.component = sbol.lookupURI(componentDefinition.persistentIdentity + '/' + iceSA.component.displayId + '/' + componentDefinition.version)
                }

                        iceSA.locations.forEach((iceLocation) => {

                            if(iceLocation instanceof Range) {

                                const range = sbol.range()
                                range.displayId = iceLocation.displayId
                                range.persistentIdentity = sa.persistentIdentity + '/' + range.displayId
                                range.version = componentDefinition.version
                                range.uri = range.persistentIdentity + '/' + range.version
                                range.start = iceLocation.start
                                range.end = iceLocation.end
                                range.orientation = iceLocation.orientation

                                sa.addLocation(range)

                            } else if(iceLocation instanceof GenericLocation) {

                                const genericLocation = sbol.genericLocation()
                                genericLocation.displayId = iceLocation.displayId
                                genericLocation.persistentIdentity = sa.persistentIdentity + '/' + genericLocation.displayId
                                genericLocation.version = componentDefinition.version
                                genericLocation.uri = genericLocation.persistentIdentity + '/' + genericLocation.version
                                genericLocation.orientation =  iceLocation.orientation

                                sa.addLocation(genericLocation)

                            }  else if(iceLocation instanceof Cut) {

                                const cut = sbol.cut()
                                cut.displayId = iceLocation.displayId
                                cut.persistentIdentity = sa.persistentIdentity + '/' + cut.displayId
                                cut.version = componentDefinition.version
                                cut.uri = cut.persistentIdentity + '/' + cut.version
                                cut.orientation =  iceLocation.orientation
                                cut.at = iceLocation.at

                                sa.addLocation(cut)

                            } else {

                                throw new Error('unknown location type?')

                            }

                        })

                        componentDefinition.addSequenceAnnotation(sa)

                    })
                }

                return Promise.resolve(componentDefinition)
            }

        }
    }


}




