
import java from 'synbiohub/java';
import extend = require('xtend');
import config from 'synbiohub/config';

async function changeURIPrefix(inFilename, opts) {

    opts = extend({

        sbolFilename: inFilename,
        uriPrefix: 'http://some_uri_prefix/',
        requireComplete: config.get('requireComplete'),
        requireCompliant: config.get('requireCompliant'),
        enforceBestPractices: config.get('requireBestPractice'),
        typesInURI: false,
        version: '1',
        keepGoing: false,
        topLevelURI: ''

    }, opts)

    let result = await java('changeURIPrefix', opts)

    const { success, log, errorLog, resultFilename } = result

    return result
}

export default changeURIPrefix;


