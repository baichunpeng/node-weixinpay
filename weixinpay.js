'use strict'
var util = require('util');
var request = require('request');
var xml2js = require('xml2js');
var Helper = require('../Helper');

var Weixinpay = function () { };

Weixinpay.key = "xxxxxxxxx";//key设置路径：微信商户平台(pay.weixin.qq.com)-->账户设置-->API安全-->密钥设置
Weixinpay.key_app = "xxxxxxxxxxxx";//
Weixinpay.appid = "xxxxxxxx";//appid-公众号
Weixinpay.appid_app = "xxxxxxxx";//appid-app
Weixinpay.mch_id = "xxxxxxx";//商户号-公众号
Weixinpay.mch_id_app = "xxxxxxxx";//商户号-app
var GUID = Helper.GUID;
Weixinpay.nonce_str = new GUID().newGUID().split('-').join('').toUpperCase();//随机字符串，不长于32位,例如：8A200592F1337BA1AFF53C02A8D9DC61
Weixinpay.notify_url = "http://www.xxxxxxx.com/weixinpay_notify";//微信支付通知地址
Weixinpay.trade_type_NATIVE = "NATIVE";//交易类型,取值如下：JSAPI，NATIVE原生扫码支付，APP
Weixinpay.trade_type_APP = "APP";//交易类型,取值如下：JSAPI，NATIVE原生扫码支付，APP

Weixinpay.sign_type = 'MD5';

Weixinpay.unite_create_orderurl = "https://api.mch.weixin.qq.com/pay/unifiedorder";//统一下单地址
Weixinpay.unite_query_orderurl = "https://api.mch.weixin.qq.com/pay/orderquery";//统一查单地址


// out_trade_no: 订单号
// product_id: 商品id，trade_type=NATIVE扫码，APP，此参数必传。此id为二维码中包含的商品ID，商户自行定义。
// total_fee: 订单总金额，单位为分
// body: 商品描述，商品或支付单简要描述
// show_url: 商品展示地址。可选。若不传此参数，则默认为 Alipay.show_url_default
Weixinpay.buildParams = function (key, appid, mch_id, out_trade_no, total_fee, body, trade_type, ip, product_id) {
    var ps = {
        appid: appid,
        mch_id: mch_id,
        nonce_str: Weixinpay.nonce_str,
        body: body,
        spbill_create_ip: ip,
        notify_url: Weixinpay.notify_url,
        trade_type: trade_type,
        out_trade_no: out_trade_no,
        product_id: product_id,
        total_fee: total_fee
    }, mysign = Weixinpay.buildSign(ps, key);
    ps.sign = mysign;
    var builder = new xml2js.Builder();
    var bodyxml = builder.buildObject(ps);
    return bodyxml;
};

Weixinpay.buildParamsOrderQuery = function (out_trade_no, tradetype) {
    var key = Weixinpay.key;
    var ps = {
            appid: Weixinpay.appid,
            mch_id: Weixinpay.mch_id,
            nonce_str: Weixinpay.nonce_str,
            out_trade_no: out_trade_no
        };
    if (tradetype === "APP") {
        key = Weixinpay.key_app;
        ps.appid = Weixinpay.appid_app;
        ps.mch_id = Weixinpay.mch_id_app;
    }
    var mysign = Weixinpay.buildSign(ps, key);
    ps.sign = mysign;
    var builder = new xml2js.Builder();
    var bodyxml = builder.buildObject(ps);
    return bodyxml;
};

//未收到支付通知的情况，商户后台系统调用【查询订单API】，商户再确认订单已支付
Weixinpay.orderquery = function (out_trade_no, tradetype, callbackFun) {
    var parseString = xml2js.parseString;
    var bodyxml = Weixinpay.buildParamsOrderQuery(out_trade_no, tradetype);
    var options = {
        headers: {"Connection": "close"},
        url: Weixinpay.unite_query_orderurl,
        method: 'POST',
        json:  false,
        body: bodyxml
    };
    function callback(error, response, data) {
        if (!error && response.statusCode == 200) {
            parseString(data, {trim:true}, function (err, result) {
                var re = result.xml;
                if (!err && re) {
                    if (re.return_code[0] === "SUCCESS") {
                        if (re.result_code[0] === "SUCCESS") {//业务结果
                            if (re.trade_state[0] === "SUCCESS") {//支付成功
                                callbackFun({
                                    trade_state:"SUCCESS"
                                });
                            } else {
                                //对当前查询订单状态的描述和下一步操作的指引,例如：支付失败，请重新下单支付
                                callbackFun({
                                    trade_msg:re.trade_state_desc[0],
                                    trade_state:"PAYERROR"
                                });
                            }
                        } else {
                            callbackFun({trade_msg:re.err_code_des[0],trade_state:"PAYERROR"});//支付失败
                        }
                    } else {//签名失败
                        callbackFun({trade_msg:re.return_msg[0],trade_state:"PAYERROR"});//支付失败
                    }
                } else {
                    Helper.log({trade_msg:"解析xml错误"+err,bodyxml:bodyxml});
                    callbackFun({trade_msg:"解析xml错误"+err});
                }
            });
        } else {
            callbackFun({trade_msg:"查询微信订单异常"});
        }
    }
    request(options, callback);
};

//成功会返回例如：{"codeurl": "http://xxx.xx.xxxx",},有错误时会返回例如：{"errMsg": "订单已关闭",}
//当return_code和result_code都为SUCCESS时
Weixinpay.getQRcode = function (out_trade_no, total_fee, body, product_id, callbackFun) {
    total_fee = parseInt(total_fee);
    var parseString = xml2js.parseString;
    var bodyxml = Weixinpay.buildParams(Weixinpay.key, Weixinpay.appid, Weixinpay.mch_id, out_trade_no, total_fee, body,
        Weixinpay.trade_type_NATIVE, Weixinpay.spbill_create_ip(), product_id);//扫码支付：NATIVE
    var options = {
        headers: {"Connection": "close"},
        url: Weixinpay.unite_create_orderurl,
        method: 'POST',
        json:  false,
        body: bodyxml
    };
    function callback(error, response, data) {
        if (!error && response.statusCode == 200) {
            parseString(data, function (err, result) {
                var re = result.xml;
                if (!err && re) {
                    if (re.return_code[0] === "SUCCESS") {
                        if (re.result_code[0] === "SUCCESS") {
                            if (re.trade_type[0] === "NATIVE") {
                                callbackFun({codeurl:re.code_url[0],trade_type:re.trade_type[0],prepay_id:re.prepay_id[0]});
                            } else {
                                callbackFun({errMsg:"交易类型不是NATIVE（原生）",trade_type:re.trade_type[0],prepay_id:re.prepay_id[0]});
                            }
                        } else {
                            callbackFun({errMsg:re.err_code_des[0]});
                        }
                    } else {
                        callbackFun({errMsg:re.return_msg[0]});
                    }
                } else {
                    Helper.log({errMsg:"解析xml错误"+err,bodyxml:bodyxml});
                    callbackFun({errMsg:"解析xml错误"+err});
                }
            });
        }
    }
    request(options, callback);
};

//微信支付APP-统一下单接口返回正常的prepay_id，再按签名规范重新生成签名后，将数据传输给APP
Weixinpay.getAPPargs = function (out_trade_no, total_fee, body, product_id, ip, callbackFun) {
    total_fee = parseInt(total_fee);
    var parseString = xml2js.parseString;
    var bodyxml = Weixinpay.buildParams(Weixinpay.key_app, Weixinpay.appid_app, Weixinpay.mch_id_app,
        out_trade_no, total_fee, body, Weixinpay.trade_type_APP, ip, product_id);
    var options = {
        headers: {"Connection": "close"},
        url: Weixinpay.unite_create_orderurl,
        method: 'POST',
        json:  false,
        body: bodyxml
    };
    Helper.log(options);
    function callback(error, response, data) {
        if (!error && response.statusCode == 200) {
            parseString(data, function (err, result) {
                var re = result.xml;
                if (!err && re) {
                    re = Weixinpay.formatParaForSign(re);
                    Helper.log(re);
                    if (re.return_code === "SUCCESS") {
                        if (re.result_code === "SUCCESS") {
                            var timestamp = (Date.parse(new Date())/1000).toString();
                            var ps = {
                                appid: Weixinpay.appid_app,
                                partnerid: Weixinpay.mch_id_app,
                                prepayid: re.prepay_id,
                                noncestr: re.nonce_str,
                                timestamp: timestamp,
                                package: "Sign=WXPay"
                            }, mysign = Weixinpay.buildSign(ps, Weixinpay.key_app);
                            ps.sign = mysign;
                            callbackFun(ps);
                        } else {
                            callbackFun({errMsg:re.err_code_des});
                        }
                    } else {
                        callbackFun({errMsg:re.return_msg});
                    }
                } else {
                    Helper.log({errMsg:"解析xml错误"+err,bodyxml:bodyxml});
                    callbackFun({errMsg:"解析xml错误"+err});
                }
            });
        }
    }
    request(options, callback);
};


//拼接链接后面的参数,参与签名
Weixinpay.createLinkString = function (params) {
    var str = '', ks = Object.keys(params).sort();
    for (var i = 0; i < ks.length; i++) {
        var k = ks[i];
        if (str.length > 0) {
            str += '&';
        }
        if (k! = null && k != undefined && k != '') {//如果参数的值为空不参与签名；
            str += k + '=' + params[k];
        }
    }
    return str;
};


Weixinpay.filterPara = function (params) {
    var obj = {};
    for (var k in params) { 
        var _k = k.toLowerCase();
        if (_k != 'sign' && params[k]) {//验证调用返回或微信主动通知签名时，传送的sign参数不参与签名，将生成的签名与该sign值作校验。
            obj[k] = params[k];
        }
    }
    return obj;
};

//格式化xml转过来的参数为正常，例如{sign:['asdasd123234asd']},转化为{sign:'asdasd123234asd'}
Weixinpay.formatParaForSign = function (params) {
    var obj = {};
    for (var k in params) {
        var _k = k.toLowerCase();
        if (_k != 'sign' && params[k]) {//验证调用返回或微信主动通知签名时，传送的sign参数不参与签名，将生成的签名与该sign值作校验。
            obj[k] = params[k][0];
        }
    }
    return obj;
};

//微信支付生成签名
Weixinpay.buildSign = function (params, key) {
    var stringSignTemp = Weixinpay.createLinkString(params) + "&key=" + key,
        signValue = '';
    switch (Weixinpay.sign_type) {
        case 'MD5':
            signValue = Helper.md5(stringSignTemp).toUpperCase();
            break;
        default:
            signValue = '';
            break;
    }
    return signValue;
};

//获取服务器ip
//Weixinpay.spbill_create_ip = "";//终端IP,APP和网页支付提交用户端ip，Native支付填调用微信支付API的机器IP。
Weixinpay.spbill_create_ip = function (){
    var interfaces = require('os').networkInterfaces();
    for(var devName in interfaces){
        var iface = interfaces[devName];
        for(var i=0;i<iface.length;i++){
            var alias = iface[i];
            if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal){
                return alias.address;
            }
        }
    }
};


module.exports = Weixinpay;
