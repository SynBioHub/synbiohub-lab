
var loadTemplate = require('../loadTemplate')
import config from 'synbiohub/config'
var pug = require('pug')
import getUrisFromReq from 'synbiohub/getUrisFromReq'
var sparql = require('../sparql/sparql')
var SBOLDocument = require('sboljs')
var extend = require('xtend')
import parseForm from 'synbiohub/parseForm'

const request = require('request')
const multiparty = require('multiparty')
const uriToUrl = require('../uriToUrl')
const attachments = require('../attachments')
import uploads from '../uploads'
const fs = require('mz/fs')
import db from 'synbiohub/db'

export default function(req, res) {

    if (req.method === 'POST'){

      submitPost(req, res)
    }

    else{

      submitForm(req, res, {}, {})

    }

}

async function submitForm(req, res, submissionData, locals){

    const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req)

    req.setTimeout(0) // no timeout
    
    var plan_names = []
    var plan_uris = []

    var submissionData = extend({
        createdBy: req.user,
    }, submissionData)

    var locals = extend({
      config: config.get(),
      user: req.user,
      errors: [],
      submission: submissionData,
      canEdit: true,
    }, locals)

    var plan_query = "PREFIX prov: <http://www.w3.org/ns/prov#> SELECT ?s WHERE { ?s a prov:Plan .}"


    let plans = await sparql.queryJson(plan_query, graphUri)


    for (var plan of plans){
      plan_names.push(plan['s'].split('/').pop())
      plan_uris.push(plan['s'])
    }

    let users = await db.model.User.findAll()


    locals = extend({
      agent_names: users.map(x=>x.name),
      agent_uris: users.map(x=>x.graphUri),
      plan_names: plan_names,
      plan_uris: plan_uris
    }, locals)

    res.send(pug.renderFile('templates/views/createTest.jade', locals))

}


async function submitPost(req, res){

    const { graphUri, uri, designId, baseUri, url } = getUrisFromReq(req)

    req.setTimeout(0) // no timeout
  
    let { fields, files } = await parseForm(req)

    console.log(fields)

    console.log(files)

    var errors = []

    const submissionData = {

    experiment_name: fields['experiment_name'][0],
    agent: fields['agent'][0],
    description: fields['description'][0],
    metadata: fields['metadata'][0],
    dataurl: fields['dataurl'][0]

    }

    var chosen_plan = ''
    var chosen_plan_uri = ''


    if (fields['experiment_name'][0] === ''){

    errors.push('Please give the experiment a name.')

    }

    if (fields['agent'][0] === ''){

    errors.push('Please mention who performed the experiment.')

    }

    if (fields['description'][0] === ''){

    errors.push('Please mention the purpose of this experiment.')

    }

    if ('plan_submission_type[]' in fields){

    if (fields['plan2'][0] === ''){

        errors.push('Please mention which protocol was used in the lab.')

    }

    else {

        chosen_plan = fields['plan2'][0]
    }

    if (files['file'][0]['size'] === 0){

        errors.push('Please upload a file describing the lab protocol.')

    }

    }

    else{

    if (fields['plan1'][0] === ''){

        errors.push('Please select the protocol that was used in the lab.')

    }

    else {

        chosen_plan = JSON.parse(fields['plan1'])[1]
        chosen_plan_uri = JSON.parse(fields['plan1'])[0]
    }

    }

    if (files['metadata_file'][0]['size'] === 0){

        errors.push('Please upload a file containing metadata for the experiment.')

    }

    if (fields['dataurl'][0] === ''){
    errors.push('Please specify a URL that contains the experimental data.')
    }


    if (errors.length > 0) {
        if (req.forceNoHTML || !req.accepts('text/html')) {
            res.status(500).type('text/plain').send(errors)
            return
        } else {
            return submitForm(req, res, submissionData, {
                errors: errors
            })
        }
    }

    else{

    var prefix = baseUri
    var displayId = fields['experiment_name'][0].replace(/\s+/g, '')
    var version = '1'


    var form_vals = {

        prefix: prefix,
        displayId: displayId,
        version: version,
        agent_str: JSON.parse(fields['agent'])[1],
        agent_uri: JSON.parse(fields['agent'])[0],
        description: fields['description'][0],
        dataurl: fields['dataurl'][0],
        chosen_plan: chosen_plan,
        chosen_plan_uri: chosen_plan_uri,
        graphUri: graphUri,
        uri: uri

    }

    var sbol_results = await createSBOLTest(form_vals)
    var doc = sbol_results[0]
    var col_uri = sbol_results[1]
    var activity_uri = doc.provActivities[0].uri.toString()

    let temp = graphUri.split('/').pop()

    if (files['file'][0]['size'] != 0){

        let fileStream = await fs.createReadStream(files['file'][0]['path']);

        let uploadInfo = await uploads.createUpload(fileStream)
    
        var { hash, size, mime } = uploadInfo
    
        await attachments.addAttachmentToTopLevel(graphUri, baseUri, prefix + '/' + chosen_plan.replace(/\s+/g, ''),
        files['file'][0]['originalFilename'], hash, size, mime,
        temp)
    }


    if (files['metadata_file'][0]['size'] != 0){

        let metaFileStream = await fs.createReadStream(files['metadata_file'][0]['path']);

        let metaUploadInfo = await uploads.createUpload(metaFileStream)
    
        var { hash, size, mime } = metaUploadInfo

        await attachments.addAttachmentToTopLevel(graphUri, baseUri, activity_uri,
        files['metadata_file'][0]['originalFilename'], hash, size, mime,
        temp)
    }

    await sparql.upload(graphUri, doc.serializeXML(), 'application/rdf+xml')

    res.redirect(col_uri)


    }


  

}


async function createSBOLTest(form_vals){

    var prefix = form_vals['prefix']
    var displayId = form_vals['displayId']
    var version = form_vals['version']
  
    var graphUri = form_vals['graphUri']
    var uri = form_vals['uri']
  
    var agent_str = form_vals['agent_str']
    var agent_uri = form_vals['agent_uri']
    var plan_str = form_vals['chosen_plan']
    var chosen_plan_uri = form_vals['chosen_plan_uri']
  
    var dataurl = form_vals['dataurl']
    var description = form_vals['description']
  
    var doc= new SBOLDocument();
    var document = doc
    var plan_uri
  
    var asc = doc.provAssociation(prefix + '/' + displayId + '_association/' + version)
    asc.displayId = displayId + '_association'
    asc.persistentIdentity = prefix + '/' + asc.displayId
    asc.version = version
    asc.addRole('http://sbols.org/v2#test')
  
    if (chosen_plan_uri === ''){
  
      plan_uri = prefix + '/' + plan_str.replace(/\s+/g, '')
    }
  
    else{
      plan_uri = chosen_plan_uri
    }
  
    var agent = doc.provAgent(agent_uri)
    agent.displayId = agent_str
    agent.name = agent_str
    agent.persistentIdentity = agent_uri
  
    var plan = doc.provPlan(plan_uri)
    plan.displayId = plan_str.replace(/\s+/g, '')
    plan.name = plan_str
    plan.persistentIdentity = plan_uri
  
    agent.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', agent.uri)
    plan.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', plan.uri)
  
    asc.agent = agent_uri
    asc.plan = plan_uri
  
    var act = doc.provActivity(prefix + '/' + displayId + '_activity/' + version)
    act.displayId = displayId + '_activity'
    act.persistentIdentity = prefix + '/' + act.displayId
    act.version = version
  
    act.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', act.uri)
    act.addAssociation(asc)
  
    var usg = doc.provUsage(prefix + '/' + displayId + '_usage/' + version)
    usg.displayId = displayId + '_usage'
    usg.persistentIdentity = prefix + '/' + usg.displayId
    usg.version = version
    usg.entity = uri
  
    usg.addRole('http://sbols.org/v2#build')
    act.addUsage(usg)
  
    var col = doc.collection(prefix + '/' + displayId + '/' + version)
    col.displayId = displayId
    col.persistentIdentity = prefix + '/' + col.displayId
    col.version = version
    col.description = description
    col.built = prefix + '/' + displayId + '/' + version
  
    col.addWasGeneratedBy(act.uri)
    col.wasDerivedFrom = uri
    col.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#ownedBy', graphUri)
    col.addUriAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel', col.uri)
    col.addStringAnnotation('http://wiki.synbiohub.org/wiki/Terms/synbiohub#Test', 'true') //HACK TO MAKE IT A DIFFERENT KIND OF COLLECTION
  
    var dataAttachment = doc.attachment(dataurl)
    dataAttachment.source = dataurl
    col.addAttachment(dataAttachment)
  
    console.log(doc.serializeXML())
  
    return [doc, col.uri]
  
  }
  

