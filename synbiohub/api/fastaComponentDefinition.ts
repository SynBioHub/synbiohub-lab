var pug = require('pug')

const { fetchSBOLObjectRecursive } = require('../fetch/fetch-sbol-object-recursive')

var sbolmeta = require('sbolmeta')

import config from 'synbiohub/config'

import getUrisFromReq from 'synbiohub/getUrisFromReq'

module.exports = function(req, res) {

    const { graphUri, uri, designId, share } = getUrisFromReq(req, res)

    let result = await fetchSBOLObjectRecursive(uri, graphUri)

    const sbol = result.sbol
    const componentDefinition = result.object

    var meta = sbolmeta.summarizeComponentDefinition(componentDefinition)

    var lines = []
    var charsPerLine = 70

    meta.sequences.forEach((sequence, i) => {

        lines.push('>' + meta.name + ' sequence ' + (i + 1)
            + ' (' + sequence.length + ' ' + sequence.lengthUnits + ')')

        for(var i = 0; i < sequence.length; ) {

            lines.push(sequence.elements.substr(i, charsPerLine))
            i += charsPerLine
        }

    })

    var fasta = lines.join('\n')

    res.header('content-type', 'text/plain').send(fasta)
};


