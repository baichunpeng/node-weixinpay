'use strict';
var Weixinpay = require('weixinpay');

/**------------------------weixinpay start----------------------*/
//微信支付NATIVE-扫码支付方式获取二维码地址
exports.weixinpay_getQRcode = function (req, res) {
    Helper.log('Weixinpay getQRcode:');
    var orderno = '123456789';
    
    var total_fee = 100;//单位：分
    var body = '描述';//商品或支付单简要描述。string(32)
    var product_id = ['001','002'];
    product_id = product_id.join('').substring(0,31);//trade_type=NATIVE，此参数必传。此id为二维码中包含的商品ID，商户自行定义。string(32)
    Weixinpay.getQRcode(orderno, total_fee, body, product_id,function (re) {
        res.send(re);
    });
};
//微信支付APP-统一下单接口返回正常的prepay_id，再按签名规范重新生成签名后，将数据传输给APP
exports.weixinpay_getAPPargs = function (req, res) {
    Helper.log('Weixinpay getAPPargs:');
    var orderno = '123456789';
    var ip = req.ip.substr(req.ip.lastIndexOf(':') + 1);
    
    var total_fee = 100;//单位：分
    var body = '描述';//商品或支付单简要描述。string(32)
    var product_id = ['001','002'];
    product_id = product_id.join('').substring(0,31);//trade_type=NATIVE，此参数必传。此id为二维码中包含的商品ID，商户自行定义。string(32)
    Weixinpay.getAPPargs(orderno, total_fee, body, product_id, ip, function (re) {
        res.send(re);
    });
};

//异步消息通知商户后台系统支付结果
//商户后台系统需回复接收情况，通知微信后台系统不再发送该单的支付通知。
exports.weixinpay_notify = function (req, res) {
    Helper.log('Weixinpay notify:');
    //xxxxxx
};


//未收到支付通知的情况，商户后台系统调用【查询订单API】，商户再确认订单已支付
exports.weixinpay_orderquery = function (req, res) {
    Helper.log('Weixinpay orderquery:orderno[' + orderno + ']'+'tradetype['+tradetype+']');
    //xxxxxxxxxxxxxxxx
};
/**------------------------weixinpay end----------------------*/
