const Bot = require('./lib/Bot')
const SOFA = require('sofa-js')
const Fiat = require('./lib/Fiat')
const REQUEST = require('request');
const unit = require('ethjs-unit');

let bot = new Bot()

// ROUTING

bot.onEvent = function(session, message) {
  switch (message.type) {
    case 'Init':
      onInit(session)
      break
    case 'Message':
      onMessage(session, message)
      break
    case 'Command':
      onCommand(session, message)
      break
    case 'Payment':
      onPayment(session, message)
      break
  }
}

function onInit(session, init) {
  session.set('transaction', false);
  session.reply(SOFA.Message({
    controls: [
      {
        type: "group",
        label: "Market Info",
        controls: [
          {type: "button", label: "BTC", value: "marketInfo"},
          {type: "button", label: "BAT", value: "marketInfo"},
          {type: "button", label: "FUN", value: "marketInfo"},
          {type: "button", label: "XMR", value: "marketInfo"}
        ]
      },
      {
        type: "group",
        label: "Transaction",
        "controls": [
          {type: "button", label: "BTC", value: "transaction"},
          {type: "button", label: "BAT", value: "transaction"},
          {type: "button", label: "FUN", value: "transaction"},
          {type: "button", label: "XMR", value: "transaction"}
        ]
      },
      {
        type: "group",
        label: "Other",
        "controls": [
          {type: "button", label: "Transaction Status", value: "transactionStatus"},
          {type: "button", label: "About", value: "about"},
          {type: "button", label: "Donate", value: "donate"}
        ]
      }
    ]
  })) 
}

function onMessage(session, message) {
  if (session.get('transactionAmount' === true)) {
    session.set('transactionAmount', false);
    transactionAmount(session)
  } else if (session.get('transactionAddress') === true) {
    session.set('transactionAddress', false);
    session.set('shiftAmount', message.body);
    transactionAddress(session)
  } else if (session.get('transaction') === true) {
    session.set('transaction', false);
    session.set('destinationAddress', message.body);
    transaction(session)
  } else {
    onInit(session)
  }
}

function onCommand(session, command) {
  session.set('currencyPair', command.content.body);
  switch (command.content.value) {
    case 'marketInfo':
      marketInfo(session)
      break
    case 'transaction':
      transactionAmount(session)
      break
    case 'transactionStatus':
      transactionStatus(session)
      break
    case 'about':
      about(session)
      break
    case 'donate':
      donate(session)
      break
    }
}

// STATES
function marketInfo(session) {
  session.set('transaction', false);
  REQUEST('https://shapeshift.io/marketinfo/eth' + '_' + session.get('currencyPair'), function(error, response, body) {
    console.log('error:', error); // Print the error if one occurred
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    console.log('body:', body); // Print the HTML for the Google homepage.
    session.reply(body);
  })
}

function transactionAmount(session) {
  session.set('transactionAddress', true);
  session.reply('How much ETH would you like to shift to ' + session.get('currencyPair'));
}

function transactionAddress(session) {
  session.set('transaction', true);
  session.reply('What is your destination address?');
}

function transaction(session) {
  REQUEST('https://shapeshift.io/shift/', {form: {
    'withdrawal': session.get('destinationAddress'),
    'returnAddress': session.get('paymentAddress'),
    'pair': 'eth-' + session.get('currencyPair')
  }}, function(error, response, body) {
    console.log('error:', error); // Print the error if one occurred
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    console.log('body:', body); // Print the HTML for the Google homepage.
    if (error) {
      session.reply(error);
    } else {
      session.set('shapeShiftDepositAddress', body.deposit)
      session.reply(
        SOFA.PaymentRequest({
          body: "Confirm you would like to shift eth to " + session.get('currencyPair'),
          value: unit.toWei(session.get('shiftAmount'), 'ether'),
          destinationAddress: body.deposit
        })
      );
    }
  })
}

function transactionStatus(session) {
  if (session.get('shapeShiftDepositAddress')) {
    REQUEST('https://shapeshift.io/txstat/' + session.get('shapeShiftDepositAddress'), function(error, response, body) {
      console.log('error:', error); // Print the error if one occurred
      console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      console.log('body:', body); // Print the HTML for the Google homepage.
      if (error) {
        session.reply(error);
      } else {
        session.reply(body);
      }
    })
  } else {
    session.reply('You have not started a transaction')
  }
}

function donate(session) {
  // request $1 USD at current exchange rates
  Fiat.fetch().then((toEth) => {
    session.requestEth(toEth.USD(1))
  })
}

function about(session, message) {
  session.reply('This app uses the ShapeShift API to convert ETH to other currencies. Code available at https://github.com/rfpowell/shapeshift-toshi, created by @robpowell.')
}

function onPayment(session, message) {
  if (message.fromAddress == session.config.paymentAddress) {
    // handle payments sent by the bot
    if (message.status == 'confirmed') {
      // perform special action once the payment has been confirmed
      // on the network
    } else if (message.status == 'error') {
      // oops, something went wrong with a payment we tried to send!
    }
  } else {
    // handle payments sent to the bot
    if (message.status == 'unconfirmed') {
      // payment has been sent to the ethereum network, but is not yet confirmed
      sendMessage(session, `Thanks for the payment! 🙏`);
    } else if (message.status == 'confirmed') {
      // handle when the payment is actually confirmed!
    } else if (message.status == 'error') {
      sendMessage(session, `There was an error with your payment!🚫`);
    }
  }
}