var request = require('request');
var _ = require('underscore');
var url = require('url');


var DEFAULT_HOST = process.env.DEBUG==='local' ? "http://test-mis.tuji.com:9090" :process.env.DEBUG==='test'?"http://mis-test.tuji.com":"http://mis.uugtv.com";
var DEFAULT_PATH_NAME = '/passport/service/checkNetAuth';

module.exports = function(opt) {
    return function(req, res, next) {
        var rpcHeader = getKeyVal(req, "x-rpc-header");
        var uid = getKeyVal(req, "__PASSPORT_UID__") || getKeyVal(req, "uid");
        var type = getKeyVal(req, 'type');
        type = type == null && rpcHeader == null ? 1 : (rpcHeader ? 0 : 1);

        var action = getKeyVal(req, 'action');
        var method = type == 1 ? getKeyVal(req, 'method') : '';

        if (type == 1 && action == null) {
            var component = url.parse(req.originalUrl);
            action = component.pathname;
        }

        if (type == 1 && method == null) {
            method = req.method == "GET" ? 0 : 1;
        }

        if (!uid || !action) {
            res.json(_getResponse("PARAM_ERROR"));
            return;
        }

        opt = _.extend({}, {
            host: DEFAULT_HOST,
            pathname: DEFAULT_PATH_NAME
        }, opt);

        action = url.parse(action);
        action = action.pathname;

        var params = {
            uid: uid,
            type: type,
            method: method,
            action: action
        };

        request.post({
            url: opt.host + opt.pathname,
            form: params
        }, function(error, response, body) {
            var isPassed = true;
            var resbody = null;
            if (error || response.statusCode != 200) {
                isPassed = false;
                resbody = _getResponse("UNKNOWN_ERROR");
            } else {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    isPassed = false;
                    body = _getResponse("UNKNOWN_ERROR");
                }

                if (body.error != 9 && body.error != 0) {
                    isPassed = false;
                }

                resbody = body;
            }

            if (typeof opt.fn == "function") {
                opt.fn(req, res, isPassed, params, next);
                return;
            }

            if (!isPassed) {
                res.json(resbody);
                return;
            }

            next();
        });
    }
};

function getKeyVal(req, key) {
    return req.headers[key] ||
        req.session[key] ||
        req.body[key] ||
        req.query[key] ||
        req.params[key];
}

function _getResponse(key, data) {
    var map = {
        SUCCESS: { error: 0, domain: "net-auth-middleware", msg: "success" },
        PARAM_ERROR: { error: 1, domain: "net-auth-middleware", msg: "param error" },
        UNKNOWN_ERROR: { error: 2, domain: "net-auth-middleware", msg: "unknown error" }
    };
    return _.extend(map[key], { data: data || {} });
}