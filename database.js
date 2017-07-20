var mysql = require('mysql');

function checkError(err) {
    if (err) {
        console.trace(err);
        return true;
    }
    return false;
}

function Database(conninfo) {
    var _this = this;

    _this.connect = function () {
        _this.conn = mysql.createConnection(conninfo);

        _this.conn.on('error', function (err) {
            console.trace(err);
            setTimeout(_this.connect, conninfo.reconnectdelay);
        });

        _this.conn.connect(function (err) {
            if (err) {
                console.trace(err);
                setTimeout(_this.connect, conninfo.reconnectdelay);
            } else {
                console.log('Connected to database');
            }
        });
    };
    _this.connect();

    _this.checkErrorCallback = function (error, callback) {
        if (checkError(error)) {
            callback({
                error: 'Internal DB error'
            });
            return true;
        }
        return false;
    };

    _this.getUserData = function (uid) {
        return new Promise(function (resolve, reject) {
            _this.conn.query('SELECT * FROM users WHERE id=?', uid, function (error, results, fields) {
                if (_this.checkErrorCallback(error,  reject)) return;
                if (results.length == 0) {
                    reject({error: 'User not found'});
                } else {
                    resolve(JSON.parse(results[0].data));
                }
            });
        });
    };

    _this.setUserData = function (uid, data) {
        return new Promise(function (resolve, reject) {
            _this.getUserData(uid).then(function () {
                _this.conn.query('UPDATE users SET data=? WHERE id=?', [JSON.stringify(data), uid], function (error, results, fields) {
                    if (_this.checkErrorCallback(error,  reject)) return;
                    resolve({success: true});
                });
            }, function () {
                _this.conn.query('INSERT INTO users(id, data) VALUES(?, ?)', [uid, JSON.stringify(data)], function (error, results, fields) {
                    if (_this.checkErrorCallback(error,  reject)) return;
                    resolve({success: true});
                });
            });
        });
    };
}

module.exports = {
    Database: Database
};