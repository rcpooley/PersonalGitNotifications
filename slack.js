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

var subscribed = {};

module.exports = {
    init: function (request) {
        api.req = request;
    },
    updateAccess: function (access) {
        api.access = access;
    },
    onMessage: function (from, msg) {
        var args = msg.split(' ');
        msg = args.splice(0, 1)[0].toLowerCase();

        if (msg == 'pr') {
            api.chat.postMessage(from, 'Woooo ' + args);
        }
    },
    api: api
};