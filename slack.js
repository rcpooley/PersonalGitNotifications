var db = {
    db: undefined,
    getUserData: function (uid) {
        return new Promise(function (resolve, reject) {
            db.db.getUserData(uid).then(resolve, function () {
                resolve({
                    prs: []
                });
            });
        });
    },
    setUserData: function (uid, data) {
        return db.db.setUserData(uid, data);
    },
    getUserDataByGitUsername: function (gitusername) {
        return db.db.getUserDataByGitUsername(gitusername);
    },
    getUsers: function () {
        return db.db.getUsers();
    }
};

var api = {
    baseUrl: 'https://slack.com/api/',
    req: undefined,
    access: undefined,
    call: function (endpoint, data) {
        return new Promise(function (resolve, reject) {
            api.req.post(api.baseUrl + endpoint, {form: data}, function (err, resp, body) {
                if (err) {
                    reject(err);
                } else {
                    resolve(JSON.parse(body));
                }
            });
        });
    },
    im: {
        list: function () {
            return api.call('im.list', {token: api.access.access_token});
        }
    },
    chat: {
        postMessage: function (channel, text) {
            return api.call('chat.postMessage', {
                token: api.access.bot.bot_access_token,
                channel: channel,
                text: text,
                as_user: true
            });
        }
    }
};

var msgTimeouts = {};
function delayMsg(channel, text) {
    if (msgTimeouts[channel]) return;
    msgTimeouts[channel] = setTimeout(function () {
        delete msgTimeouts[channel];
        api.chat.postMessage(channel, text);
    }, 1000);
}

var msgs = {
    onSubscribed: 'You have been subscribed to <{link}|{type} #{num} "{title}">',
    onUpdate: 'There are new changes in <{link}|{type} #{num} "{title}">'
};

module.exports = {
    init: function (request, database) {
        api.req = request;
        db.db = database;
    },
    updateAccess: function (access) {
        api.access = access;
    },
    onMessage: function (from, msg) {
        var respond = function (txt) {
            api.chat.postMessage(from, txt);
        };

        console.log('got "' + msg + '" from ' + from);

        var args = msg.split(' ');
        msg = args.splice(0, 1)[0].toLowerCase();

        if (msg == 'help') {
            respond('Commands: setgituser, pr');
        } else if (msg == 'setgituser') {
            if (args.length == 0) {
                respond('Usage: setgituser [your git username]');
            } else {
                db.getUserData(from).then(function (data) {
                    data.gitusername = args[0];
                    data.slackid = from;
                    db.setUserData(from, data).then(function () {
                        respond('Your git username has been updated to "' + data.gitusername + '"');
                    });
                });
            }
        } else if (msg == 'pr') {
            if (args.length == 0) {
                respond('Usage:\n' +
                    'pr status\n' +
                    'pr add [pull req number]\n' +
                    'pr rm [pull req number]');
            } else {
                db.getUserData(from).then(function (data) {
                    data.slackid = from;
                    var prs = data.prs;
                    if (args[0] == 'status') {
                        console.log(data);
                        if (prs.length == 0) {
                            respond('You are not subscribed to any pull requests');
                        } else {
                            respond('You are subscribed to PRs #' + prs);
                        }
                    } else if (args[0] == 'add') {
                        if (args.length > 1) {
                            var num = parseInt(args[1].replace('#',''));
                            prs.push(num);
                            db.setUserData(from, data).then(function () {
                                respond('You are now subscribed to PR #' + num);
                            });
                        } else {
                            respond('Invalid arguments');
                        }
                    } else if (args[0] == 'rm') {
                        if (args.length > 1) {
                            var num = parseInt(args[1].replace('#',''));
                            var idx = prs.indexOf(num);
                            if (idx == -1) {
                                respond('You are not subscribed to PR #' + num);
                            } else {
                                prs.splice(idx, 1);
                                db.setUserData(from, data).then(function () {
                                    respond('You are no longer subscribed to PR #' + num);
                                });
                            }
                        } else {
                            respond('Invalid arguments');
                        }
                    }
                });
            }
        }
    },
    handlePullRequest: function (pr) {
        var users = pr.assignees.concat(pr.requested_reviewers).concat([pr.user]);
        for (var i = 0; i < users.length; i++) {
            module.exports.handleGitUser(users[i], pr);
        }
    },
    handleGitUser: function (user, pr) {
        if (!user) return;
        var prnum = pr.number;
        var prtitle = pr.title;
        var prurl = pr['html_url'];

        var gitusername = user.login;
        db.getUserDataByGitUsername(gitusername).then(function (data) {
            if (data.prs.indexOf(prnum) == -1) {
                data.prs.push(prnum);
                db.setUserData(data.slackid, data).then(function () {
                    delayMsg(data.slackid, msgs.onSubscribed.replace('{num}', prnum).replace('{title}', prtitle).replace('{type}', pr.mytype == 'pr' ? 'Pull Request' : 'Issue').replace('{link}', prurl));
                });
            }
        }, function () {});
    },
    broadcastPRUpdate: function (pr) {
        var prnum = pr.number;
        var prtitle = pr.title;
        var prurl = pr['html_url'];

        db.getUsers().then(function (users) {
            for (var i = 0; i < users.length; i++) {
                var data = JSON.parse(users[i].data);
                if (data.prs.indexOf(prnum) >= 0) {
                    delayMsg(data.slackid, msgs.onUpdate.replace('{num}', prnum).replace('{title}', prtitle).replace('{type}', pr.mytype == 'pr' ? 'Pull Request' : 'Issue').replace('{link}', prurl));
                }
            }
        }, function () {});
    },
    api: api
};