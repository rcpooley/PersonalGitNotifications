var util = {};

util.randomStr = function (len) {
    var alpha = 'abcdefghijklmnopqrstuvwxyz';
    var str = '';
    for (var i = 0; i < len; i++) {
        str += alpha.charAt(parseInt(Math.random() * alpha.length));
    }
    return str;
};

module.exports = {
    util: util
};