import pug from 'pug';
import config from 'synbiohub/config';

export default function(req, res) {

    var criteria = {};

    if(req.user)
        criteria.createdBy = req.user;

    triplestore.search(
        locals.triplestores, criteria, function(err, results) {

        if(err) {
	    locals = {
		config: config.get(),
                section: 'errors',
                user: req.user,
                errors: [ err ]
	    }
	    res.send(pug.renderFile('templates/views/errors/errors.jade', locals))
	    return        
        }

        res.status(200).send(results);
    });

};


