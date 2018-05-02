import pug from 'pug';
import { fetchSBOLObjectRecursive } from 'synbiohub/fetch/fetch-sbol-object-recursive';
import sbolmeta from 'sbolmeta';
import config from 'synbiohub/config';
import getUrisFromReq from 'synbiohub/getUrisFromReq';

export default async function(req, res) {

    const { graphUri, uri, designId, share } = getUrisFromReq(req, res)

    let result = await fetchSBOLObjectRecursive(uri, graphUri)

    const sbol = result.sbol
    const sequence = result.object

    var meta = sbolmeta.summarizeSequence(sequence)

    var lines = []
    var charsPerLine = 70

    lines.push('>' + meta.name 
        + ' (' + meta.length + ' ' + meta.lengthUnits + ')')

    for(var i = 0; i < meta.length; ) {

        lines.push(meta.elements.substr(i, charsPerLine))
        i += charsPerLine
    }

    var fasta = lines.join('\n')

    res.header('content-type', 'text/plain').send(fasta)
};


