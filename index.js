var bt = require('node.bittrex.api');
var fs = require('fs');
var rp = require('request-promise');
var util = require('util');
var getbalance = util.promisify(bt.getbalance);
var buymarket = util.promisify(bt.buymarket);
var sellmarket = util.promisify(bt.sellmarket);
var buylimit = util.promisify(bt.buylimit);
var selllimit = util.promisify(bt.selllimit);
var getmarketsummary = util.promisify(bt.getmarketsummary);
var getopenorders = util.promisify(bt.getopenorders);
bt.options({
  'apikey' : '',
  'apisecret' : ''
});

//params
//required only for first time run
const firstDealLimitPrice = 0.00075949;
const market = 'btc-nxs';
const sourceCoin = 'BTC';
const targetCoin = 'NXS';
const diffBuy =     0.000005;
const diffSell =    0.000005;
const priceOffset = 0.00000003;

let buy = true;
let previousDealPrice = null;
let previousOpenOrders = 0;

async function trade() {
    let openOrders = await getOpenOrdersCount(market);
    if (previousOpenOrders > 0 && openOrders == 0) {
        console.log('@deal');
        previousOpenOrders = 0;
    }
    if (openOrders > 0) {
        previousOpenOrders = openOrders;
        return;
    }


    let price = await getLast(market);
    if (buy) {   
        if ((previousDealPrice == null && price <= firstDealLimitPrice) 
            || (previousDealPrice != null && price < previousDealPrice - diffBuy)) {
            let availableBtc = await getAvailableBalance(sourceCoin);
            //buy
            // calculate quantity and substract 1%
            let quantity = Number((availableBtc / price).toFixed(6));
            quantity = quantity - (quantity * 0.01);

            //calculate price: add a bit to price, to make deal as first one
            //price = price + (price * priceOffsetFactor);

            let res = await buyLimit(market, quantity, price + priceOffset);
            if (res) {
                previousDealPrice = price;
                buy = false;
                let d = new Date().toLocaleString();
                console.log(`[${d}] [${price}]: BUY ${quantity} ${targetCoin}`);
            }
        }
    //sell
    } else {
        if ((previousDealPrice == null && price >= firstDealLimitPrice) 
            || (previousDealPrice != null && price > previousDealPrice + diffSell)) {
            let availableTarget = await getAvailableBalance(targetCoin);
            //sell
            
            //calculate price: substract a bit from price, to make deal as first
            //price = price - (price * priceOffsetFactor);
            let res = await sellLimit(market, availableTarget, price - priceOffset);
            if (res) {
                previousDealPrice = price;
                buy = true;
                let d = new Date().toLocaleString();
                console.log(`[${d}] [${price}]: SELL ${availableTarget} ${targetCoin}`);
            }
        }
    }
}

async function getOpenOrders(mrkt) {
    try {
        let res = await getopenorders({market : mrkt});
        if (res.success) {
            return res.result;
        } else return false;
    } catch(ex) {
        if (ex.success) {
            return ex.result;
        } else return false;
    }
}

async function getOpenOrdersCount(mrkt) {
    try {

    return (await getOpenOrders(mrkt)).length;
    } catch(er) {
        console.log(er);
    }
}

async function getMarketSummary(mrkt) {
    try {
        let res = await getmarketsummary({market : mrkt});
        return res.result[0];
    } catch(ex) {
        if (ex.success) {
            return ex.result[0];
        }
    }
}

async function getLast(mrkt) {
    return parseFloat((await getMarketSummary(mrkt)).Last);
}

async function buyLimit(mrkt, howmuch, lmt) {
    try {
        let res = await buylimit({market : mrkt, quantity: howmuch, rate: lmt});
        if (!res.success) {
            console.log(res);
            return false;
        }
        return true;
    } catch(ex) {
        if (ex.success) {
            return true;
        } else {
            console.log('buylimit ERROR');
            console.dir(ex);
            return false;
        }
    }
}

async function sellLimit(mrkt, howmuch, lmt) {
    try {
        let res = await selllimit({market : mrkt, quantity: howmuch, rate: lmt});
        if (!res.success) {
            console.log(res);
            return false;
        }
        return true;
    } catch(ex) {
        if (ex.success) {
            return true;
        } else {
            console.log('selllimit ERROR');
            console.dir(ex);
            return false;
        }
    }
}

async function getAvailableBalance(currency) {
    return parseFloat((await getBalance(currency)).Available);
}
async function getBalance(currency) {
    try {
        let balance = await getbalance({currency : currency});
        return balance.result;
    } catch(ex) {
        if (ex.success) {
            return ex.result;
        }
    }
}

trade();
setInterval(trade, 60000);