var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var fs = require('fs');
var request = require('request');
var config = require('./config.json');
var util = require('./util').util;
var database = require('./database');
var db = new database.Database(config.mysql);
var slack = require('./slack');
slack.init(request, db);

//Setup middleware
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

//Store our access information and attempt to load from database
var access;
db.getVal('access').then(function (data) {
    access = data;
    slack.updateAccess(access);
    console.log('Loaded access from db');
}, util.nofunc);

//Store our pr/issue types
var prTypes = {};
db.getVal('prtypes').then(function (data) {
    prTypes = data;
    console.log('Loaded prtypes from db');
}, util.nofunc);

function savePRTypes() {
    return db.setVal('prtypes', prTypes);
}

//Handle get requests
app.get('/slackauth', function (req, res) {
    if (!req.query.code || !req.query.state) {
        res.send('Invalid query parameters');
    }

    request.post('https://slack.com/api/oauth.access', {
        form: {
            client_id: config.slack.client_id,
            client_secret: config.slack.client_secret,
            code: req.query.code,
            redirect_uri: config.slack.redirect_uri
        }
    }, function (error, response, body) {
        if (error) throw error;
        access = JSON.parse(body);
        slack.updateAccess(access);
        db.setVal('access', access);
        if (access.ok) {
            res.redirect('index.html');
        } else {
            res.send('Authentication failed. Got ' + body);
        }
    });
});

app.get('/test', function (req, res) {
    db.setVal('test', {a: 1});
});

app.get('/msg', function (req, res) {
    if (!req.query.msg) return;
    slack.onMessage('U61C8VBHP', req.query.msg);
    res.send('Sent successfully!');
});

app.get('*', function (req, res) {
    var url = req.url.split('?')[0];
    if (url === '/')url += 'index.html';

    if (!access || !access.ok) {
        url = '/index.html';
    } else {
        url = '/success.html';
    }

    var path = __dirname + '/public/' + url;
    try {
        fs.accessSync(path, fs.F_OK);
    } catch (e) {
        path = __dirname + '/public/err404.html';
    }

    /*if (url == '/success.html') {
        res.send(JSON.stringify(access));
        return;
    }*/

    res.sendFile(path);
});

app.post('/slacksignin', function (req, res) {
    var state = util.randomStr(10);
    res.redirect('https://slack.com/oauth/authorize?client_id=' + config.slack.client_id + '&scope=' + config.slack.scopes + '&redirect_uri=' + config.slack.redirect_uri + '&state=' + state);
});

app.post('/slackevent', function (req, res) {
    if (!req.body) return;

    if (req.body.event) {
        var evt = req.body.event;

        if (evt.type == 'message') {
            slack.onMessage(evt.user, evt.text);
        }
    }

    res.send(JSON.stringify({challenge: req.body.challenge}));
});

app.post('/githook', function (req, res) {
    var data = req.body;

    var evt = req.headers['x-github-event'];
    if (!evt) return;

    var pr;

    if (evt == 'pull_request' || evt == 'pull_request_review' || evt == 'pull_request_review_comment') {
        pr = data.pull_request;
        var num = pr.number;
        if (!prTypes[num]) {
            prTypes[num] = 'pr';
            savePRTypes();
        }
    }

    if (evt == 'issues' || evt == 'issue_comment') {
        pr = data.issue;
    }

    if (pr) {
        var num = pr.number;
        if (!prTypes[num]) {
            prTypes[num] = 'issue';
            savePRTypes();
        }
        pr.mytype = prTypes[num];

        if (data.comment) {
            slack.handleGitUser(data.comment.user, pr);
        }

        slack.handlePullRequest(pr);
        slack.broadcastPRUpdate(pr);
    }

    res.send(JSON.stringify({msg: 'Success!'}));
});

//Start http server
http.listen(config.port, function () {
    console.log('Listening on *:' + config.port);
});