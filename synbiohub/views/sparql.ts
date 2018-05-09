
import config from 'synbiohub/config';
import pug = require('pug');
import extend = require('xtend')
import { Parser as SparqlParser } from 'sparqljs';
import { Generator as SparqlGenerator } from 'sparqljs'
import * as sparql from 'synbiohub/sparql/sparql';
import checkQuery from 'synbiohub/checkSparqlQuery';

export default function(req, res) {

    if(req.method === 'POST') {

        post(req, res)

    } else {

        form(req, res)

    }

};

function form(req, res, locals?) {

    const defaultQuery = []

    const namespaces = config.get('namespaces')

    Object.keys(namespaces).forEach((prefix) => {
        defaultQuery.push('PREFIX ' + prefix.split(':')[1] + ': <' + namespaces[prefix] + '>')
    })

    defaultQuery.push('', '')

    locals = extend({
        config: config.get(),
        section: 'sparql',
        user: req.user,
        errors: [],
        results: '',
        query: defaultQuery.join('\n'),
        graph: 'public'
    }, locals || {})

    res.send(pug.renderFile('templates/views/sparql.jade', locals))

}

function post(req, res) {

    req.setTimeout(0); // no timeout

    var graphUri;

    if(req.body.graph === 'user') {
        graphUri = req.user.graphUri;
    } else {
        graphUri = null;
    }

    const parser = new SparqlParser();
    const generator = new SparqlGenerator();

    var query;

    try {
        query = parser.parse(req.body.query);
    } catch(e) {
        form(req, res, {
            query: req.body.query,
            graph: req.body.graph,
            errors: [
                e.stack
            ]
        });

        return
    }

    const queryString = generator.stringify(query);

    try {
        checkQuery(query, req.user)
    } catch(e) {
        form(req, res, {
            query: req.body.query,
            graph: req.body.graph,
            errors: [
                e.stack
            ]
        })

        return
    }

    sparql.queryJson(queryString, graphUri).then((results) => {
        let headers = new Set();

        results.forEach(result => {
            Object.keys(result).forEach(key => {
                headers.add(key);
            })
        })

        form(req, res, {
            query: req.body.query,
            graph: req.body.graph,
            headers: Array.from(headers), 
            results: results
        })

    }).catch((e) => {

        form(req, res, {
            query: req.body.query,
            graph: req.body.graph,
            errors: [
                e.stack
            ]
        })

    })

}



